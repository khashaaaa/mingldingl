using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("matches/{matchId}/messages")]
[Authorize]
[Produces("application/json")]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly PushNotificationService _push;
    private readonly SupabaseBroadcastService _broadcast;

    private const int DefaultMessagePageSize = 50;
    private const int MaxMessagePageSize = 200;

    public MessagesController(AppDbContext db, ScoreService score, QuestService quests, MilestoneService milestones, PushNotificationService push, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _quests = quests;
        _milestones = milestones;
        _push = push;
        _broadcast = broadcast;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<MessageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    // Bounded to the most recent `limit` messages (default 50, capped at 200)
    // instead of the full unbounded history — a chat that's been going for
    // months used to load every message in it on every screen open. Response
    // shape is deliberately kept as a flat, oldest-first array rather than a
    // PagedResponse/keyset-cursor wrapper: the app (hooks/useChat.ts) calls
    // this with no query params, expects List<MessageResponse> back, loads it
    // once per match (staleTime/gcTime: Infinity), and relies entirely on the
    // Supabase broadcast pushed from SendMessage for anything sent afterward
    // — it has no scroll-back-to-load-older-messages UI today. The optional
    // `before` cursor here exists for that feature when it's built, without
    // it this is purely "cap what a single load can return".
    public async Task<IActionResult> GetMessages(Guid matchId, [FromQuery] DateTime? before = null, [FromQuery] int limit = DefaultMessagePageSize)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        limit = Math.Clamp(limit <= 0 ? DefaultMessagePageSize : limit, 1, MaxMessagePageSize);

        var query = _db.Messages.Where(m => m.MatchId == matchId);
        if (before is not null) query = query.Where(m => m.CreatedAt < before);

        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .ToListAsync();
        messages.Reverse(); // newest-first for the query, but oldest-first is the contract callers expect

        return Ok(messages.Select(ToResponse).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(SendMessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendMessage(Guid matchId, [FromBody] SendMessageRequest req)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");
        if (string.IsNullOrWhiteSpace(req.Content)) return this.BadRequestError("Content is required");

        var lastMessage = await _db.Messages
            .Where(m => m.MatchId == matchId)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

        // The whole transactional block below is wrapped in the execution
        // strategy so EnableRetryOnFailure (Program.cs) can retry it on a
        // transient DB failure — EF Core forbids a manually-opened
        // BeginTransactionAsync outside of one. The Message entity is built
        // fresh *inside* the delegate (not captured from outer scope) so a
        // retry can't re-Add() an already-tracked instance from a prior,
        // rolled-back attempt.
        var (message, newMessageCount) = await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            var msg = new Message
            {
                MatchId = matchId,
                SenderId = userId,
                Content = req.Content,
            };

            await using var tx = await _db.Database.BeginTransactionAsync();
            _db.Messages.Add(msg);
            await _db.SaveChangesAsync();

            // Atomic increment — loading MessageCount, incrementing it in memory, and
            // saving is a lost-update race under concurrent sends to the same match
            // (confirmed via stress test: 40 concurrent messages only advanced the
            // counter by 2 instead of 40). UPDATE ... RETURNING does the increment
            // and reads the resulting count back in one round trip, with no window
            // between an update and a separate read of "the new value".
            // SqlQuery<T> tries to compose a wrapping SELECT for LINQ operators like
            // SingleAsync(), which isn't valid over UPDATE ... RETURNING — materialize
            // to a list first (as EF's own error for this suggests), then take the
            // one row client-side.
            var updateResult = await _db.Database.SqlQuery<int>(
                $"""
                UPDATE "Matches" SET
                    "MessageCount" = "MessageCount" + 1,
                    "LastMessageAt" = {msg.CreatedAt},
                    "LastMessageSenderId" = {userId}
                WHERE "Id" = {matchId}
                RETURNING "MessageCount"
                """).ToListAsync();
            // Single(), not SingleOrDefault(): unlike BusinessController.Rate's
            // equivalent aggregate update, this can't return zero rows short of
            // a schema change — Messages.MatchId is FK-constrained to Matches.Id,
            // so _db.SaveChangesAsync() just above would already have thrown on
            // the FK violation if this match didn't exist, before ever reaching
            // this UPDATE.
            int count = updateResult.Single();
            await tx.CommitAsync();
            return (msg, count);
        });

        int baseAward = 0;
        if (lastMessage is null)
        {
            await _score.AwardAsync(userId, "FirstMessage");
            baseAward = ScoreService.GetDelta("FirstMessage");
        }
        else if (lastMessage.SenderId != userId)
        {
            await _score.AwardAsync(userId, "MatchReply");
            baseAward = ScoreService.GetDelta("MatchReply");
        }

        int questBonus = await _quests.IncrementAsync(userId, "message");
        int awarded = baseAward + questBonus;

        if (newMessageCount >= 10) await _milestones.AchieveAsync(userId, "ten_messages_one_match");

        var sender = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        var recipientId = match.OtherParticipant(userId);
        await _push.NotifyUserAsync(
            recipientId,
            sender?.DisplayName ?? "New message",
            req.Content,
            new Dictionary<string, object> { ["matchId"] = matchId.ToString(), ["type"] = "message" });

        var response = ToResponse(message);
        // Supabase Realtime postgres_changes only observes Supabase's own hosted
        // Postgres — since messages now live in local Postgres, Broadcast is the
        // only way to push this live to a client. One broadcast for the open
        // chat screen (if any), one for the global nudge toast.
        await _broadcast.BroadcastAsync($"chat:{matchId}", "INSERT", response);
        await _broadcast.BroadcastAsync("app-nudges", "message", new { senderId = userId, matchId });

        return Ok(new SendMessageResponse(response, awarded));
    }

    private static MessageResponse ToResponse(Message m) =>
        new(m.Id, m.MatchId, m.SenderId, m.Content, m.CreatedAt);
}
