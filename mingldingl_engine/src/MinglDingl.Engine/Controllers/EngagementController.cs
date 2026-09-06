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
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ConfigService _config;

    public EngagementController(AppDbContext db, EngagementService engagement, ScoreService score, QuestService quests, MilestoneService milestones, SupabaseBroadcastService broadcast, ConfigService config)
    {
        _db = db; _engagement = engagement; _score = score; _quests = quests; _milestones = milestones; _broadcast = broadcast; _config = config;
    }

    [HttpGet("reveal-thresholds")]
    [ProducesResponseType(typeof(RevealThresholdsResponse), StatusCodes.Status200OK)]
    public IActionResult GetRevealThresholds()
    {
        var levels = RevealService.EffectiveThresholds(_config)
            .Select(t => new RevealThresholdDto(t.Level, t.Messages))
            .ToList();
        return Ok(new RevealThresholdsResponse(levels));
    }

    [HttpGet("icebreaker/{matchId}")]
    [ProducesResponseType(typeof(IcebreakerQuestionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetIcebreaker(Guid matchId)
    {
        var icebreakers = await _db.Icebreakers
            .Where(i => i.IsActive)
            .OrderBy(i => i.Id)
            .ToListAsync();
        if (icebreakers.Count == 0) return this.NotFoundError("No active icebreaker available", "icebreaker.none_available");

        var icebreaker = icebreakers[StableIndex(matchId, icebreakers.Count)];
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

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId, requireActive: true);
        if (accessError is not null) return accessError;

        var existing = await _db.IcebreakerResponses.FirstOrDefaultAsync(r =>
            r.MatchId == matchId && r.IcebreakerId == req.IcebreakerId && r.UserId == userId);
        if (existing is not null) return this.ConflictError("Already responded", "engagement.already_responded");

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
            _db.ChangeTracker.Clear();
            return this.ConflictError("Already responded", "engagement.already_responded");
        }

        await _broadcast.BroadcastAsync("app-nudges", "icebreaker", new { userId, matchId });

        bool bothDone = await _engagement.BothRespondedAsync(matchId, req.IcebreakerId);
        int awarded = 0;
        if (bothDone)
        {
            var otherUserId = match.OtherParticipant(userId);
            await _engagement.CompleteIcebreakerAsync(matchId, userId, otherUserId);
            awarded = _score.Delta("IcebreakerDone") + await _quests.IncrementAsync(userId, "icebreaker");
            await _quests.IncrementAsync(otherUserId, "icebreaker");
            await _milestones.AchieveAsync(userId, "first_icebreaker");
            await _milestones.AchieveAsync(otherUserId, "first_icebreaker");
        }

        return Ok(new IcebreakerRespondResult(bothDone, awarded));
    }

    [HttpGet("icebreaker/{matchId}/reveal")]
    [ProducesResponseType(typeof(List<IcebreakerRevealEntry>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevealIcebreaker(Guid matchId, [FromQuery] Guid icebreakerId)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

        var responses = await _db.IcebreakerResponses
            .Where(r => r.MatchId == matchId && r.IcebreakerId == icebreakerId)
            .ToListAsync();

        if (responses.Count < 2) return this.BadRequestError("Icebreaker not complete yet", "icebreaker.incomplete");

        return Ok(responses.Select(r => new IcebreakerRevealEntry(r.UserId, r.Answer)).ToList());
    }

    [HttpGet("icebreaker/{matchId}/status")]
    [ProducesResponseType(typeof(IcebreakerStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetIcebreakerStatus(Guid matchId, [FromQuery] Guid icebreakerId)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

        var responded = await _db.IcebreakerResponses.AnyAsync(r =>
            r.MatchId == matchId && r.IcebreakerId == icebreakerId && r.UserId == userId);
        return Ok(new IcebreakerStatusResponse(responded));
    }

    [HttpGet("quiz")]
    [ProducesResponseType(typeof(QuizDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuiz([FromQuery] Guid? matchId = null)
    {
        var quizzes = await _db.Quizzes.OrderBy(q => q.Id).ToListAsync();
        if (quizzes.Count == 0) return this.NotFoundError("No quiz available", "quiz.none_available");

        // Compatibility is only computed between two responses to the same quiz, so the pick has
        // to be stable per match rather than random per request.
        var quiz = quizzes[matchId is Guid m ? StableIndex(m, quizzes.Count) : 0];

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
            var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId.Value, requireActive: true);
            if (accessError is not null) return accessError;
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
            _db.ChangeTracker.Clear();
            isFirstResponse = false;
        }

        int awarded = 0;
        if (isFirstResponse)
        {
            await _score.AwardAsync(userId, "QuizDone");
            awarded = _score.Delta("QuizDone") + await _quests.IncrementAsync(userId, "quiz");
            await _milestones.AchieveAsync(userId, "first_quiz");
            if (req.MatchId.HasValue)
                await _broadcast.BroadcastAsync("app-nudges", "quiz", new { userId, matchId = req.MatchId });
        }

        int? compatibility = req.MatchId.HasValue
            ? await FindCompatibilityAsync(quizId, userId, req.MatchId.Value, req.Answers)
            : null;

        return Ok(new QuizCompatibilityResponse(compatibility, awarded));
    }

    [HttpGet("quiz/{quizId}/status")]
    [ProducesResponseType(typeof(QuizStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetQuizStatus(Guid quizId, [FromQuery] Guid matchId)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

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
        var defs = _quests.QuestsForDate(today);
        var rows = await _db.UserDailyQuests.AsNoTracking()
            .Where(r => r.UserId == userId && r.QuestDate == today).ToListAsync();
        bool chestClaimed = await _db.ScoreEvents.AnyAsync(e =>
            e.UserId == userId && e.EventType == "QuestChest" && e.CreatedAt >= today);

        var quests = defs.Select(d =>
        {
            var row = rows.FirstOrDefault(r => r.QuestId == d.Id);
            // A target lowered in config below progress already made counts as done, so the board
            // and the chest agree; the XP itself is paid when the quest's action next fires.
            return new QuestEntryResponse(d.Id, d.NameKey, d.Target, row?.Progress ?? 0, row?.CompletedAt is not null || (row?.Progress ?? 0) >= d.Target, d.Xp);
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
        var defs = _quests.QuestsForDate(today);
        var rows = await _db.UserDailyQuests.AsNoTracking()
            .Where(r => r.UserId == userId && r.QuestDate == today).ToListAsync();
        bool allComplete = defs.All(d => rows.Any(r => r.QuestId == d.Id && (r.CompletedAt != null || r.Progress >= d.Target)));
        if (!allComplete) return this.BadRequestError("Complete all quests to claim the bounty chest", "quest.incomplete");

        bool chestClaimed = await _db.ScoreEvents.AnyAsync(e =>
            e.UserId == userId && e.EventType == "QuestChest" && e.CreatedAt >= today);
        if (chestClaimed) return Ok(new ClaimChestResponse(0, true));

        int chestXp = _score.QuestChestXp;
        if (!await _score.TryAwardClaimedAsync(userId, "QuestChest", chestXp))
            return Ok(new ClaimChestResponse(0, true));

        return Ok(new ClaimChestResponse(chestXp, false));
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
        if (def is null) return this.NotFoundError("Unknown milestone", "milestone.unknown");
        var exists = await _db.UserMilestones.AnyAsync(m => m.UserId == userId && m.MilestoneId == id);
        if (!exists) return this.BadRequestError("Milestone not achieved yet", "milestone.not_achieved");

        int rowsAffected = await _db.UserMilestones
            .Where(m => m.UserId == userId && m.MilestoneId == id && m.OpenedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.OpenedAt, DateTime.UtcNow));
        if (rowsAffected == 0) return Ok(new OpenMilestoneResponse(0, null, true));

        await _score.AwardWithDeltaAsync(userId, "MilestoneChest", def.Xp);
        return Ok(new OpenMilestoneResponse(def.Xp, null, false));
    }

    /// <summary>
    /// Deterministic index derived from a match id, so both participants are served the same
    /// item and it does not change between screen loads. Uses a hash rather than GetHashCode,
    /// which is randomised per process and would differ between the two users' requests.
    /// </summary>
    private static int StableIndex(Guid seed, int count) =>
        count <= 0 ? 0 : (int)(BitConverter.ToUInt32(
            System.Security.Cryptography.SHA256.HashData(seed.ToByteArray()), 0) % (uint)count);
}
