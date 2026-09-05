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

    public async Task<IActionResult> GetMessages(Guid matchId, [FromQuery] DateTime? before = null, [FromQuery] Guid? beforeId = null, [FromQuery] int limit = DefaultMessagePageSize)
    {
        var (_, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

        limit = Math.Clamp(limit <= 0 ? DefaultMessagePageSize : limit, 1, MaxMessagePageSize);

        var query = _db.Messages.Where(m => m.MatchId == matchId);
        // The cursor has to use the same two-part key the page is ordered by. On `CreatedAt` alone
        // it silently drops every message tying with the boundary instant: they sort after the
        // cursor on the page it came from, and `CreatedAt < before` excludes them from the next.
        // `beforeId` is optional so a client on the older one-part cursor still pages.
        if (before is not null)
            query = beforeId is not null
                ? query.Where(m => m.CreatedAt < before || (m.CreatedAt == before && m.Id.CompareTo(beforeId.Value) < 0))
                : query.Where(m => m.CreatedAt < before);

        // Id breaks ties: CreatedAt alone left messages written in the same instant in an order the
        // database was free to vary between the two queries either side of a page boundary.
        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.Id)
            .Take(limit)
            .ToListAsync();
        messages.Reverse();

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

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId, requireActive: true);
        if (accessError is not null) return accessError;
        if (string.IsNullOrWhiteSpace(req.Content)) return this.BadRequestError("Content is required", "content.required");

        var lastMessage = await _db.Messages
            .Where(m => m.MatchId == matchId)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

        var (message, newMessageCount) = await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            // A retry re-runs this whole lambda, and a Message added by a failed attempt is still in
            // the change tracker as Added — the next SaveChanges would insert it alongside the new
            // one, two rows for one send against a counter that moved by one. Only this method's own
            // additions are dropped; clearing the tracker outright would take unsaved work belonging
            // to whoever else shares this scoped context.
            foreach (var stale in _db.ChangeTracker.Entries<Message>().Where(e => e.State == EntityState.Added).ToList())
                stale.State = EntityState.Detached;

            var msg = new Message
            {
                MatchId = matchId,
                SenderId = userId,
                Content = req.Content,
            };

            await using var tx = await _db.Database.BeginTransactionAsync();
            _db.Messages.Add(msg);
            await _db.SaveChangesAsync();

            var updateResult = await _db.Database.SqlQuery<int>(
                $"""
                UPDATE "Matches" SET
                    "MessageCount" = "MessageCount" + 1,
                    "LastMessageAt" = {msg.CreatedAt},
                    "LastMessageSenderId" = {userId}
                WHERE "Id" = {matchId}
                RETURNING "MessageCount"
                """).ToListAsync();

            int count = updateResult.Single();
            await tx.CommitAsync();
            return (msg, count);
        });

        match.MessageCount = newMessageCount;
        match.LastMessageAt = message.CreatedAt;
        match.LastMessageSenderId = userId;

        int baseAward = 0;
        if (lastMessage is null)
        {
            await _score.AwardAsync(userId, "FirstMessage");
            baseAward = _score.Delta("FirstMessage");
        }
        else if (lastMessage.SenderId != userId)
        {
            await _score.AwardAsync(userId, "MatchReply");
            baseAward = _score.Delta("MatchReply");
        }

        int questBonus = await _quests.IncrementAsync(userId, "message");
        int awarded = baseAward + questBonus;

        if (newMessageCount >= 10) await _milestones.AchieveAsync(userId, "ten_messages_one_match");

        var sender = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        var recipientId = match.OtherParticipant(userId);
        await _push.NotifyUserAsync(
            recipientId,
            PushKind.NewMessage,
            new Dictionary<string, object> { ["matchId"] = matchId.ToString() },
            sender?.DisplayName ?? "New message", req.Content);

        var response = ToResponse(message);

        await _broadcast.BroadcastAsync($"chat:{matchId}", "INSERT", response);
        await _broadcast.BroadcastAsync("app-nudges", "message", new { senderId = userId, matchId });

        return Ok(new SendMessageResponse(response, awarded));
    }

    private static MessageResponse ToResponse(Message m) =>
        new(m.Id, m.MatchId, m.SenderId, m.Content, m.CreatedAt);
}
