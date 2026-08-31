using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/townsquare")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminTownSquareController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TownSquareService _townSquare;
    private readonly AdminAuditService _audit;

    public AdminTownSquareController(AppDbContext db, TownSquareService townSquare, AdminAuditService audit)
    {
        _db = db;
        _townSquare = townSquare;
        _audit = audit;
    }

    [HttpGet("sessions")]
    [ProducesResponseType(typeof(PagedResponse<AdminTownSquareSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSessions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.TownSquareSessions.AsNoTracking().OrderByDescending(s => s.ScheduledStartAt);
        var totalCount = await query.CountAsync();
        var sessions = await query.Skip(skip).Take(safePageSize).ToListAsync();

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var rsvpCounts = await _db.TownSquareRsvps.AsNoTracking()
            .Where(r => sessionIds.Contains(r.SessionId))
            .GroupBy(r => r.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.SessionId, g => g.Count);

        var items = sessions.Select(s => ToDto(s, rsvpCounts.GetValueOrDefault(s.Id, 0))).ToList();

        return Ok(new PagedResponse<AdminTownSquareSessionDto>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    [HttpPost("sessions")]
    [ProducesResponseType(typeof(AdminTownSquareSessionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSession([FromBody] CreateTownSquareSessionRequest req)
    {
        var rsvpOpensAt = AsUtc(req.RsvpOpensAt);
        var rsvpClosesAt = AsUtc(req.RsvpClosesAt);
        var scheduledStartAt = AsUtc(req.ScheduledStartAt);

        if (rsvpOpensAt >= rsvpClosesAt) return this.BadRequestError("RsvpOpensAt must be before RsvpClosesAt");
        if (rsvpClosesAt > scheduledStartAt) return this.BadRequestError("RsvpClosesAt must be on or before ScheduledStartAt");
        if (scheduledStartAt <= DateTime.UtcNow) return this.BadRequestError("ScheduledStartAt must be in the future");

        var session = new TownSquareSession
        {
            Id = Guid.NewGuid(),
            RsvpOpensAt = rsvpOpensAt,
            RsvpClosesAt = rsvpClosesAt,
            ScheduledStartAt = scheduledStartAt,
            Status = "Open",
            CurrentRoundNumber = 0,
        };
        _db.TownSquareSessions.Add(session);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "CreateTownSquareSession", "TownSquareSession", session.Id.ToString(), $"starts {scheduledStartAt:O}");

        return StatusCode(StatusCodes.Status201Created, ToDto(session, 0));
    }

    [HttpPost("sessions/{sessionId}/cancel")]
    [ProducesResponseType(typeof(AdminTownSquareSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelSession(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session is null) return this.NotFoundError("Session not found");
        if (session.Status is not ("Open" or "Locked"))
            return this.ConflictError($"Cannot cancel a session with status '{session.Status}'");

        var previous = session.Status;
        await _townSquare.CancelSessionAsync(sessionId);
        await _audit.LogAsync(User, "CancelTownSquareSession", "TownSquareSession", sessionId.ToString(), $"was {previous}");

        var cancelled = await _db.TownSquareSessions.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var rsvpCount = await _db.TownSquareRsvps.AsNoTracking().CountAsync(r => r.SessionId == sessionId);
        return Ok(ToDto(cancelled, rsvpCount));
    }

    [HttpGet("sessions/{sessionId}/pairings")]
    [ProducesResponseType(typeof(List<AdminTownSquarePairingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionPairings(Guid sessionId)
    {
        var sessionExists = await _db.TownSquareSessions.AsNoTracking().AnyAsync(s => s.Id == sessionId);
        if (!sessionExists) return this.NotFoundError("Session not found");

        var pairings = await _db.TownSquarePairings.AsNoTracking()
            .Include(p => p.Round)
            .Include(p => p.UserA)
            .Include(p => p.UserB)
            .Where(p => p.Round.SessionId == sessionId)
            .OrderBy(p => p.Round.RoundNumber)
            .Select(p => new AdminTownSquarePairingDto(
                p.Id, p.Round.RoundNumber,
                p.UserAId, p.UserA.DisplayName, p.UserAResponse, p.UserAJoinedAt,
                p.UserBId, p.UserB.DisplayName, p.UserBResponse, p.UserBJoinedAt,
                p.ResultingMatchId))
            .ToListAsync();

        return Ok(pairings);
    }

    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();

    private static AdminTownSquareSessionDto ToDto(TownSquareSession s, int rsvpCount) => new(
        s.Id, s.Status, s.RsvpOpensAt, s.RsvpClosesAt, s.ScheduledStartAt,
        s.CurrentRoundNumber, rsvpCount, s.CreatedAt);
}
