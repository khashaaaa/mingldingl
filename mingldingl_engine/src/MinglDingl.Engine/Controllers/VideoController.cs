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

    public VideoController(AppDbContext db, VideoTokenService videoToken, ScoreService score, QuestService quests, LootService loot, MilestoneService milestones)
    {
        _db = db;
        _videoToken = videoToken;
        _score = score;
        _quests = quests;
        _loot = loot;
        _milestones = milestones;
    }

    [HttpPost("token")]
    [ProducesResponseType(typeof(VideoTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetToken([FromBody] VideoTokenRequestDto req)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(req.MatchId);

        if (match is null) return this.NotFoundError("Match not found");
        if (!match.VideoCallUnlocked) return this.ForbiddenError("Video call not unlocked for this match");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        string token = _videoToken.GenerateToken(req.MatchId);
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
        var match = await _db.Matches.FindAsync(req.MatchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");
        if (!match.VideoCallUnlocked)
            return this.ForbiddenError("Video call not unlocked for this match");

        // VideoRewardClaimed is deliberately a separate flag from VideoCallUnlocked
        // — the latter is the durable "this couple can video call" capability (set
        // once by ActivityService.ConfirmAsync, never revoked), this one is purely
        // the one-shot "has the completion reward already been paid out" gate.
        // Reusing VideoCallUnlocked itself for both would permanently lock GetToken
        // out after the first completed call. Atomic conditional claim:
        // ExecuteUpdateAsync issues a single UPDATE ... WHERE, so two concurrent
        // /video/complete calls (or repeated calls) for the same match can't both
        // observe VideoRewardClaimed == false and both award — only the request
        // that flips it wins, closing the unlimited-score-farming hole (previously
        // this action never checked the match at all).
        int rowsAffected = await _db.Matches
            .Where(m => m.Id == req.MatchId && !m.VideoRewardClaimed)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.VideoRewardClaimed, true));
        if (rowsAffected == 0)
            return this.ForbiddenError("Video call reward already claimed for this match");

        await _score.AwardAsync(userId, "VideoCallDone");
        int questBonus = await _quests.IncrementAsync(userId, "video");
        await _milestones.AchieveAsync(userId, "first_video_call");
        var drop = await _loot.RollDropAsync(userId, "drop");
        return Ok(new VideoCompleteResponse(ScoreService.GetDelta("VideoCallDone") + questBonus, drop));
    }
}
