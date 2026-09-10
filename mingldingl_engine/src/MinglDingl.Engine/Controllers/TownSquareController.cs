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
        var locale = await _db.Users.AsNoTracking()
            .Where(u => u.Id == this.CurrentUserId())
            .Select(u => u.PreferredLocale)
            .FirstOrDefaultAsync();

        string token = _videoToken.GenerateToken(pairing.Id);
        string channelName = pairing.Id.ToString("N");
        DateTime roundEndsAt = round.StartsAt.AddSeconds(round.DurationSeconds);

        return Ok(new CurrentRoundResponse(
            pairing.Id, pairing.OtherParticipant(userId), token, channelName, _videoToken.AppId,
            icebreaker is null ? "" : LocalisedContent.Pick(locale, icebreaker.QuestionText, icebreaker.QuestionTextEn),
            round.RoundNumber, roundEndsAt));
    }

    /// <summary>
    /// What became of a gathering, for the caller. The round screen polls
    /// <see cref="GetCurrentRound"/>, which refuses anything that is not InProgress — so a session
    /// finishing normally arrived at the client as an error and was shown as "you left the square,
    /// the session moved on without you". A completed session is not a failure, and the matches it
    /// produced were never surfaced anywhere: this is what the screen reads instead.
    /// </summary>
    [HttpGet("session/{sessionId}/summary")]
    [ProducesResponseType(typeof(SessionSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionSummary(Guid sessionId)
    {
        var userId = this.CurrentUserId();
        var session = await _db.TownSquareSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session is null) return this.NotFoundError("Session not found", "square.session_not_found");

        var pairings = await (
            from p in _db.TownSquarePairings.AsNoTracking()
            join r in _db.TownSquareRounds on p.RoundId equals r.Id
            where r.SessionId == sessionId && (p.UserAId == userId || p.UserBId == userId)
            orderby r.RoundNumber
            select new { p.UserAId, p.UserBId, p.ResultingMatchId }
        ).ToListAsync();

        var matched = pairings.Where(p => p.ResultingMatchId != null).ToList();
        var otherIds = matched.Select(p => p.UserAId == userId ? p.UserBId : p.UserAId).ToList();

        // Every match is created at RevealLevel 1, which is exactly the rung that shows a display
        // name — so this is the same thing the Quest Log already shows for these matches, not a way
        // around progressive reveal. A deleted account has no name to show.
        var names = await _db.Users.AsNoTracking()
            .Where(u => otherIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.IsDeleted ? null : u.DisplayName);

        var matches = matched.Select(p =>
        {
            var otherId = p.UserAId == userId ? p.UserBId : p.UserAId;
            return new SessionSummaryMatch(p.ResultingMatchId!.Value, otherId, names.GetValueOrDefault(otherId));
        }).ToList();

        return Ok(new SessionSummaryResponse(session.Status, pairings.Count, matches));
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
/// <summary>
/// <paramref name="PartnerUserId"/> is who the caller is sitting opposite. The screen needs it to
/// offer a report: a Town Square partner is a stranger the caller has no match with, and reporting
/// used to be reachable only from a conversation.
/// </summary>
public record CurrentRoundResponse(
    Guid PairingId, Guid PartnerUserId, string VideoToken, string ChannelName, string AppId,
    string IcebreakerText, int RoundNumber, DateTime RoundEndsAt);

/// <param name="Status">The session's own status — "Completed" is the normal end, not a fault.</param>
/// <param name="RoundsPlayed">How many rounds the caller was actually paired into.</param>
public record SessionSummaryResponse(string Status, int RoundsPlayed, IReadOnlyList<SessionSummaryMatch> Matches);

public record SessionSummaryMatch(Guid MatchId, Guid OtherUserId, string? DisplayName);
public record TownSquareRespondDto(string Response);
public record TownSquareRespondResult(Guid? MatchId);
