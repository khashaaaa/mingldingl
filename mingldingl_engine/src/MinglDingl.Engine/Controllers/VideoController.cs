using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("video")]
[Authorize]
[Produces("application/json")]
public class VideoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly VideoTokenService _videoToken;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly LootService _loot;
    private readonly MilestoneService _milestones;
    private readonly ConfigService _config;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly PushNotificationService _push;

    public VideoController(AppDbContext db, VideoTokenService videoToken, ScoreService score, QuestService quests, LootService loot, MilestoneService milestones,
        ConfigService config, SupabaseBroadcastService broadcast, PushNotificationService push)
    {
        _db = db;
        _videoToken = videoToken;
        _score = score;
        _quests = quests;
        _loot = loot;
        _milestones = milestones;
        _config = config;
        _broadcast = broadcast;
        _push = push;
    }

    [HttpPost("token")]
    [ProducesResponseType(typeof(VideoTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetToken([FromBody] VideoTokenRequestDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId, tracked: false, requireActive: true);
        if (accessError is not null) return accessError;
        if (match.FlameRiteAcceptedAt is null)
            return this.ForbiddenError("The Flame Rite has not been accepted for this match");

        string token;
        if (match.FlameRiteCompletedAt is null)
        {
            double durationMinutes = Math.Max(1, _config.GetNumber("dating.flamerite.duration_minutes", 5));
            token = _videoToken.GenerateToken(req.MatchId, (uint)(durationMinutes * 60));
        }
        else
        {
            token = _videoToken.GenerateToken(req.MatchId);
        }
        string channelName = req.MatchId.ToString("N");
        string appId = _videoToken.AppId;

        return Ok(new VideoTokenResponse(token, channelName, appId));
    }

    [HttpPost("complete")]
    [ProducesResponseType(typeof(VideoCompleteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MarkComplete([FromBody] VideoCompleteDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId, tracked: false, requireActive: true);
        if (accessError is not null) return accessError;
        if (match.FlameRiteAcceptedAt is null)
            return this.ForbiddenError("The Flame Rite has not been accepted for this match");

        int rowsAffected = await _db.Matches
            .Where(m => m.Id == req.MatchId && !m.VideoRewardClaimed)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.VideoRewardClaimed, true));

        await _db.Matches
            .Where(m => m.Id == req.MatchId && m.FlameRiteCompletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.FlameRiteCompletedAt, DateTime.UtcNow));

        // The reward is claimed once per match, so whichever participant hangs up second always
        // lands here. Their call still ended normally — returning 403 made the app show them a
        // failure alert on every completed rite. Report a zero award instead.
        if (rowsAffected == 0)
            return Ok(new VideoCompleteResponse(0, null));

        await _score.AwardAsync(userId, "VideoCallDone");
        int questBonus = await _quests.IncrementAsync(userId, "video");
        await _milestones.AchieveAsync(userId, "first_video_call");
        var drop = await _loot.RollDropAsync(userId, "drop");

        await _broadcast.BroadcastAsync("app-nudges", "flame_rite_completed", new { userId, matchId = req.MatchId });

        return Ok(new VideoCompleteResponse(ScoreService.GetDelta("VideoCallDone") + questBonus, drop));
    }

    [HttpPost("rite/propose")]
    [ProducesResponseType(typeof(FlameRiteStateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ProposeRite([FromBody] FlameRiteRequestDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId, tracked: false, requireActive: true);
        if (accessError is not null) return accessError;
        if (!match.IcebreakerComplete)
            return this.ForbiddenError("Complete the icebreaker before proposing the Flame Rite");

        var now = DateTime.UtcNow;

        int rowsAffected = await _db.Matches
            .Where(m => m.Id == req.MatchId && m.FlameRiteProposedById == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.FlameRiteProposedById, userId)
                .SetProperty(m => m.FlameRiteProposedAt, now));
        if (rowsAffected == 0)
            return this.ConflictError("A Flame Rite proposal is already open for this match");

        var other = match.OtherParticipant(userId);
        await _push.NotifyUserAsync(
            other,
            "Flame Rite Proposed",
            "Your match wants to video-screen before pledging to meet.",
            new Dictionary<string, object> { ["matchId"] = match.Id.ToString(), ["type"] = "flame_rite_proposed" });

        await _broadcast.BroadcastAsync("app-nudges", "flame_rite_proposed", new { userId, matchId = match.Id });

        return Ok(BuildRiteState(match.Id, userId, now, null, match.FlameRiteCompletedAt));
    }

    [HttpPost("rite/accept")]
    [ProducesResponseType(typeof(FlameRiteStateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AcceptRite([FromBody] FlameRiteRequestDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId, tracked: false, requireActive: true);
        if (accessError is not null) return accessError;

        if (match.FlameRiteProposedById is null || match.FlameRiteProposedById == userId)
            return this.ForbiddenError("There is no Flame Rite proposal for you to accept");

        var now = DateTime.UtcNow;

        int rowsAffected = await _db.Matches
            .Where(m => m.Id == req.MatchId && m.FlameRiteProposedById != null && m.FlameRiteProposedById != userId)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.FlameRiteAcceptedAt, now));
        if (rowsAffected == 0)
            return this.ForbiddenError("There is no Flame Rite proposal for you to accept");

        await _broadcast.BroadcastAsync("app-nudges", "flame_rite_accepted", new { userId, matchId = match.Id });

        return Ok(BuildRiteState(match.Id, match.FlameRiteProposedById, match.FlameRiteProposedAt, now, match.FlameRiteCompletedAt));
    }

    [HttpPost("rite/decline")]
    [ProducesResponseType(typeof(FlameRiteStateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeclineRite([FromBody] FlameRiteRequestDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, req.MatchId, tracked: false);
        if (accessError is not null) return accessError;

        bool completed = match.FlameRiteCompletedAt is not null;

        bool hadOpenProposal = !completed && match.FlameRiteProposedById is not null;

        if (!completed)
        {
            await _db.Matches
                .Where(m => m.Id == req.MatchId && m.FlameRiteCompletedAt == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(m => m.FlameRiteProposedById, (Guid?)null)
                    .SetProperty(m => m.FlameRiteProposedAt, (DateTime?)null)
                    .SetProperty(m => m.FlameRiteAcceptedAt, (DateTime?)null));
        }
        if (hadOpenProposal)
            await _broadcast.BroadcastAsync("app-nudges", "flame_rite_declined", new { userId, matchId = match.Id });

        return Ok(completed
            ? BuildRiteState(match.Id, match.FlameRiteProposedById, match.FlameRiteProposedAt, match.FlameRiteAcceptedAt, match.FlameRiteCompletedAt)
            : BuildRiteState(match.Id, null, null, null, match.FlameRiteCompletedAt));
    }

    private FlameRiteStateResponse BuildRiteState(Guid matchId, Guid? proposedById, DateTime? proposedAt, DateTime? acceptedAt, DateTime? completedAt) =>
        new(matchId, proposedById, proposedAt, acceptedAt, completedAt,
            (int)_config.GetNumber("dating.flamerite.duration_minutes", 5));
}
