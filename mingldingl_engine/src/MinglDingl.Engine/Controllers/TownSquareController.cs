using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("townsquare")]
[Authorize]
[Produces("application/json")]
[ServiceFilter(typeof(TownSquareEnabledFilter))]
public class TownSquareController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TownSquareService _townSquare;
    private readonly VideoTokenService _videoToken;

    public TownSquareController(AppDbContext db, TownSquareService townSquare, VideoTokenService videoToken)
    {
        _db = db;
        _townSquare = townSquare;
        _videoToken = videoToken;
    }

    [HttpGet("next-session")]
    [ProducesResponseType(typeof(NextSessionResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNextSession()
    {
        var userId = this.CurrentUserId();
        // An Open session whose RSVP window has not opened yet is not announced: the app's only
        // copy for it is "RSVP closes in ...", which would be a lie, and RsvpAsync refuses it.
        var now = DateTime.UtcNow;
        var session = await _db.TownSquareSessions
            .Where(s => (s.Status == "Open" && s.RsvpOpensAt <= now)
                     || s.Status == "Locked" || s.Status == "InProgress")
            .OrderBy(s => s.ScheduledStartAt)
            .FirstOrDefaultAsync();

        if (session is null) return Ok(new NextSessionResponse(null, null, null, null, null, false));

        bool isRsvpd = await _db.TownSquareRsvps.AnyAsync(r => r.SessionId == session.Id && r.UserId == userId);
        return Ok(new NextSessionResponse(session.Id, session.RsvpOpensAt, session.RsvpClosesAt, session.ScheduledStartAt, session.Status, isRsvpd));
    }

    [HttpGet("session/{sessionId}/current-round")]
    [ProducesResponseType(typeof(CurrentRoundResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrentRound(Guid sessionId)
    {
        var userId = this.CurrentUserId();
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null) return this.NotFoundError("Session not found", "square.session_not_found");
        if (session.Status != "InProgress") return this.BadRequestError("Session is not in progress", "square.not_in_progress");

        var round = await _db.TownSquareRounds
            .FirstOrDefaultAsync(r => r.SessionId == sessionId && r.RoundNumber == session.CurrentRoundNumber);
        if (round is null) return this.NotFoundError("No active round", "square.no_active_round");

        var pairing = await _db.TownSquarePairings
            .FirstOrDefaultAsync(p => p.RoundId == round.Id && (p.UserAId == userId || p.UserBId == userId));
        if (pairing is null) return this.NotFoundError("You are not paired in this round", "square.not_paired");

        var icebreaker = await _db.Icebreakers.FindAsync(round.IcebreakerId);

        string token = _videoToken.GenerateToken(pairing.Id);
        string channelName = pairing.Id.ToString("N");
        DateTime roundEndsAt = round.StartsAt.AddSeconds(round.DurationSeconds);

        return Ok(new CurrentRoundResponse(
            pairing.Id, token, channelName, _videoToken.AppId,
            icebreaker?.QuestionText ?? "", round.RoundNumber, roundEndsAt));
    }

    [HttpPost("pairing/{pairingId}/joined")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkJoined(Guid pairingId)
    {
        var userId = this.CurrentUserId();
        await _townSquare.MarkJoinedAsync(pairingId, userId);
        return Ok();
    }

    [HttpPost("pairing/{pairingId}/respond")]
    [ProducesResponseType(typeof(TownSquareRespondResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RespondToPairing(Guid pairingId, [FromBody] TownSquareRespondDto req)
    {
        var userId = this.CurrentUserId();
        var matchId = await _townSquare.RespondToPairingAsync(pairingId, userId, req.Response);
        return Ok(new TownSquareRespondResult(matchId));
    }

    [HttpPost("rsvp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Rsvp([FromBody] TownSquareRsvpDto req)
    {
        var userId = this.CurrentUserId();
        await _townSquare.RsvpAsync(req.SessionId, userId);
        return Ok();
    }

    [HttpDelete("rsvp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CancelRsvp([FromQuery] Guid sessionId)
    {
        var userId = this.CurrentUserId();
        await _townSquare.CancelRsvpAsync(sessionId, userId);
        return Ok();
    }
}

public record TownSquareRsvpDto(Guid SessionId);
public record NextSessionResponse(Guid? SessionId, DateTime? RsvpOpensAt, DateTime? RsvpClosesAt, DateTime? ScheduledStartAt, string? Status, bool IsRsvpd);
public record CurrentRoundResponse(Guid PairingId, string VideoToken, string ChannelName, string AppId, string IcebreakerText, int RoundNumber, DateTime RoundEndsAt);
public record TownSquareRespondDto(string Response);
public record TownSquareRespondResult(Guid? MatchId);
