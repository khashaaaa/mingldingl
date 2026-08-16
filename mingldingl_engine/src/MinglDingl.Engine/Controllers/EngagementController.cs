using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("engagement")]
[Authorize]
[Produces("application/json")]
public class EngagementController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EngagementService _engagement;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly LootService _loot;
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;

    public EngagementController(AppDbContext db, EngagementService engagement, ScoreService score, QuestService quests, LootService loot, MilestoneService milestones, SupabaseBroadcastService broadcast)
    {
        _db = db; _engagement = engagement; _score = score; _quests = quests; _loot = loot; _milestones = milestones; _broadcast = broadcast;
    }

    [HttpGet("icebreaker/{matchId}")]
    [ProducesResponseType(typeof(IcebreakerQuestionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetIcebreaker(Guid matchId)
    {
        var icebreaker = await _db.Icebreakers
            .Where(i => i.IsActive)
            .OrderBy(_ => Guid.NewGuid())   // random selection
            .FirstOrDefaultAsync();
        if (icebreaker is null) return this.NotFoundError("No active icebreaker available");
        return Ok(new IcebreakerQuestionResponse(icebreaker.Id, icebreaker.QuestionText, icebreaker.Type, icebreaker.Options));
    }

    [HttpPost("icebreaker/{matchId}/respond")]
    [ProducesResponseType(typeof(IcebreakerRespondResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RespondIcebreaker(Guid matchId, [FromBody] IcebreakerRespondDto req)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var existing = await _db.IcebreakerResponses.FirstOrDefaultAsync(r =>
            r.MatchId == matchId && r.IcebreakerId == req.IcebreakerId && r.UserId == userId);
        if (existing is not null) return this.ConflictError("Already responded");

        _db.IcebreakerResponses.Add(new IcebreakerResponse
        {
            MatchId = matchId,
            IcebreakerId = req.IcebreakerId,
            UserId = userId,
            Answer = req.Answer
        });
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (UniqueViolationGuard.IsViolation(ex, "IX_IcebreakerResponses_MatchId_IcebreakerId_UserId"))
        {
            // Lost the race — someone else's request for the same response
            // landed first (the check above is TOCTOU-racy; this index is the
            // real guard). Same outcome as the check catching it up front.
            _db.ChangeTracker.Clear();
            return this.ConflictError("Already responded");
        }

        // Nudge the other participant to answer too — see SupabaseBroadcastService
        // for why this is Broadcast and not postgres_changes.
        await _broadcast.BroadcastAsync("app-nudges", "icebreaker", new { userId, matchId });

        bool bothDone = await _engagement.BothRespondedAsync(matchId, req.IcebreakerId);
        DroppedItem? drop = null;
        int awarded = 0;
        if (bothDone)
        {
            var otherUserId = match.OtherParticipant(userId);
            await _engagement.CompleteIcebreakerAsync(matchId, userId, otherUserId);
            awarded = ScoreService.GetDelta("IcebreakerDone") + await _quests.IncrementAsync(userId, "icebreaker");
            await _quests.IncrementAsync(otherUserId, "icebreaker");
            drop = await _loot.RollDropAsync(userId, "drop");
        }

        return Ok(new IcebreakerRespondResult(bothDone, awarded, drop));
    }

    [HttpGet("icebreaker/{matchId}/reveal")]
    [ProducesResponseType(typeof(List<IcebreakerRevealEntry>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevealIcebreaker(Guid matchId, [FromQuery] Guid icebreakerId)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var responses = await _db.IcebreakerResponses
            .Where(r => r.MatchId == matchId && r.IcebreakerId == icebreakerId)
            .ToListAsync();

        // Match.IcebreakerComplete is a one-shot "has this match EVER
        // completed *an* icebreaker" flag (EngagementService.CompleteIcebreakerAsync
        // never resets it) -- it doesn't mean "responses exist for *this*
        // icebreakerId". GetIcebreaker picks a new random icebreaker on every
        // call, so re-opening the icebreaker screen after already completing
        // one used to pass a brand-new, unanswered icebreakerId here and get
        // 200 + [] back instead of the expected 400, which the client read as
        // "revealed" with undefined answers. Checking the actual response
        // count for this specific icebreakerId (same threshold RespondIcebreaker
        // uses via BothRespondedAsync) is the real completeness signal.
        if (responses.Count < 2) return this.BadRequestError("Icebreaker not complete yet");

        return Ok(responses.Select(r => new IcebreakerRevealEntry(r.UserId, r.Answer)).ToList());
    }

    [HttpGet("icebreaker/{matchId}/status")]
    [ProducesResponseType(typeof(IcebreakerStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetIcebreakerStatus(Guid matchId, [FromQuery] Guid icebreakerId)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var responded = await _db.IcebreakerResponses.AnyAsync(r =>
            r.MatchId == matchId && r.IcebreakerId == icebreakerId && r.UserId == userId);
        return Ok(new IcebreakerStatusResponse(responded));
    }

    [HttpGet("quiz")]
    [ProducesResponseType(typeof(QuizDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuiz()
    {
        var quiz = await _db.Quizzes
            .OrderBy(_ => Guid.NewGuid())
            .FirstOrDefaultAsync();
        if (quiz is null) return this.NotFoundError("No quiz available");

        var questions = await _db.QuizQuestions
            .Where(q => q.QuizId == quiz.Id)
            .ToListAsync();

        return Ok(new QuizDetailsResponse(
            quiz.Id, quiz.Title,
            questions.Select(q => new QuizQuestionResponse(q.Id, q.Text, q.Options)).ToList()));
    }

    [HttpPost("quiz/{quizId}/respond")]
    [ProducesResponseType(typeof(QuizCompatibilityResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RespondQuiz(Guid quizId, [FromBody] QuizRespondDto req)
    {
        var userId = this.CurrentUserId();

        if (req.MatchId.HasValue)
        {
            var match = await _db.Matches.FindAsync(req.MatchId.Value);
            if (match is null) return this.NotFoundError("Match not found");
            if (!match.IsParticipant(userId))
                return this.ForbiddenError("You are not a participant in this match");
        }

        var existing = await _db.QuizResponses.FirstOrDefaultAsync(r =>
            r.QuizId == quizId && r.UserId == userId && r.MatchId == req.MatchId);

        bool isFirstResponse = existing is null;
        if (existing is null)
        {
            existing = new QuizResponse
            {
                QuizId = quizId,
                UserId = userId,
                MatchId = req.MatchId,
                Answers = req.Answers
            };
            _db.QuizResponses.Add(existing);
        }
        else
        {
            existing.Answers = req.Answers;
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (UniqueViolationGuard.IsViolation(ex, "IX_QuizResponses_QuizId_UserId_MatchId"))
        {
            // Lost the race for the first response to this quiz (check-then-insert
            // above is TOCTOU-racy; this index is the real guard) — someone else's
            // insert for the same (QuizId, UserId, MatchId) landed first. Treat as
            // "not first" so QuizDone/loot below aren't double-awarded.
            _db.ChangeTracker.Clear();
            isFirstResponse = false;
        }

        // Quest/score/loot last: all best-effort and share this scoped DbContext,
        // so they must run after the action's own SaveChangesAsync resolves —
        // and only for the request that actually won the race above.
        DroppedItem? drop = null;
        int awarded = 0;
        if (isFirstResponse)
        {
            await _score.AwardAsync(userId, "QuizDone");
            awarded = ScoreService.GetDelta("QuizDone") + await _quests.IncrementAsync(userId, "quiz");
            drop = await _loot.RollDropAsync(userId, "drop");
            if (req.MatchId.HasValue)
                await _broadcast.BroadcastAsync("app-nudges", "quiz", new { userId, matchId = req.MatchId });
        }

        int? compatibility = req.MatchId.HasValue
            ? await FindCompatibilityAsync(quizId, userId, req.MatchId.Value, req.Answers)
            : null;

        return Ok(new QuizCompatibilityResponse(compatibility, awarded, drop));
    }

    // Read-only counterpart to RespondQuiz — safe to call on every mount
    // (e.g. after navigating back to an already-answered quiz) since it
    // never writes a response, unlike RespondQuiz which requires the
    // client to hold the answers in memory to resubmit them.
    [HttpGet("quiz/{quizId}/status")]
    [ProducesResponseType(typeof(QuizStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetQuizStatus(Guid quizId, [FromQuery] Guid matchId)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var myResponse = await _db.QuizResponses.FirstOrDefaultAsync(r =>
            r.QuizId == quizId && r.UserId == userId && r.MatchId == matchId);
        if (myResponse is null) return Ok(new QuizStatusResponse(false, null));

        var compatibility = await FindCompatibilityAsync(quizId, userId, matchId, myResponse.Answers);
        return Ok(new QuizStatusResponse(true, compatibility));
    }

    private async Task<int?> FindCompatibilityAsync(Guid quizId, Guid userId, Guid matchId, Dictionary<Guid, string> myAnswers)
    {
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return null;

        var otherUserId = match.OtherParticipant(userId);
        var otherResponse = await _db.QuizResponses.FirstOrDefaultAsync(r =>
            r.QuizId == quizId && r.UserId == otherUserId && r.MatchId == matchId);
        return otherResponse is not null
            ? EngagementService.CalculateCompatibility(myAnswers, otherResponse.Answers)
            : null;
    }

    [HttpGet("quests/today")]
    [ProducesResponseType(typeof(QuestBoardResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTodayQuests()
    {
        var userId = this.CurrentUserId();
        var today = DateTime.UtcNow.Date;
        var defs = QuestService.QuestsForDate(today);
        var rows = await _db.UserDailyQuests.AsNoTracking()
            .Where(r => r.UserId == userId && r.QuestDate == today).ToListAsync();
        bool chestClaimed = await _db.ScoreEvents.AnyAsync(e =>
            e.UserId == userId && e.EventType == "QuestChest" && e.CreatedAt >= today);

        var quests = defs.Select(d =>
        {
            var row = rows.FirstOrDefault(r => r.QuestId == d.Id);
            return new QuestEntryResponse(d.Id, d.NameKey, d.Target, row?.Progress ?? 0, row?.CompletedAt is not null, d.Xp);
        }).ToList();

        return Ok(new QuestBoardResponse(quests, quests.All(q => q.Completed), chestClaimed));
    }

    [HttpPost("quests/claim-chest")]
    [ProducesResponseType(typeof(ClaimChestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ClaimQuestChest()
    {
        var userId = this.CurrentUserId();
        var today = DateTime.UtcNow.Date;
        var defs = QuestService.QuestsForDate(today);
        var rows = await _db.UserDailyQuests.AsNoTracking()
            .Where(r => r.UserId == userId && r.QuestDate == today).ToListAsync();
        bool allComplete = defs.All(d => rows.Any(r => r.QuestId == d.Id && r.CompletedAt != null));
        if (!allComplete) return this.BadRequestError("Complete all quests to claim the bounty chest");

        bool chestClaimed = await _db.ScoreEvents.AnyAsync(e =>
            e.UserId == userId && e.EventType == "QuestChest" && e.CreatedAt >= today);
        if (chestClaimed) return Ok(new ClaimChestResponse(0, true));

        // The check above is TOCTOU-racy; ix_score_events_once_per_day (partial unique
        // index on ScoreEvents) is the real guard. The loser of a concurrent claim hits
        // a unique violation here instead of double-awarding — return the idempotent
        // already-claimed response instead of a 500.
        try
        {
            await _score.AwardWithDeltaAsync(userId, "QuestChest", 30);
        }
        catch (DbUpdateException ex) when (OncePerDayScoreEventGuard.IsViolation(ex))
        {
            _db.ChangeTracker.Clear();
            return Ok(new ClaimChestResponse(0, true));
        }
        var item = await _loot.GrantGuaranteedAsync(userId, "quest_chest");
        return Ok(new ClaimChestResponse(30, false, item));
    }

    [HttpGet("milestones")]
    [ProducesResponseType(typeof(List<MilestoneResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMilestones()
    {
        var userId = this.CurrentUserId();
        var rows = await _db.UserMilestones.AsNoTracking().Where(m => m.UserId == userId).ToListAsync();
        return Ok(MilestoneService.Defs.Select(d =>
        {
            var row = rows.FirstOrDefault(r => r.MilestoneId == d.Id);
            return new MilestoneResponse(d.Id, d.NameKey, d.Xp, row?.AchievedAt, row?.OpenedAt);
        }).ToList());
    }

    [HttpPost("milestones/{id}/open")]
    [ProducesResponseType(typeof(OpenMilestoneResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> OpenMilestone(string id)
    {
        var userId = this.CurrentUserId();
        var def = MilestoneService.Defs.FirstOrDefault(d => d.Id == id);
        if (def is null) return this.NotFoundError("Unknown milestone");
        var exists = await _db.UserMilestones.AnyAsync(m => m.UserId == userId && m.MilestoneId == id);
        if (!exists) return this.BadRequestError("Milestone not achieved yet");

        // Atomic conditional claim: only the caller that flips OpenedAt from null
        // wins the row (ExecuteUpdateAsync issues a single UPDATE ... WHERE, so two
        // concurrent requests can't both observe OpenedAt == null and both award).
        // Losers get the idempotent "already opened" response instead of a second award.
        int rowsAffected = await _db.UserMilestones
            .Where(m => m.UserId == userId && m.MilestoneId == id && m.OpenedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.OpenedAt, DateTime.UtcNow));
        if (rowsAffected == 0) return Ok(new OpenMilestoneResponse(0, null, true));

        await _score.AwardWithDeltaAsync(userId, "MilestoneChest", def.Xp);
        var item = await _loot.GrantGuaranteedAsync(userId, "milestone");
        return Ok(new OpenMilestoneResponse(def.Xp, item, false));
    }
}
