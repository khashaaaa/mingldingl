using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// Read-only support lookup for Town Square — before this, nobody could see
// session state or look up a specific stuck pairing (one side never joined
// a round, a round that never advanced) from the admin dashboard at all.
[ApiController]
[Route("admin/townsquare")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminTownSquareController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminTownSquareController(AppDbContext db) => _db = db;

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

        var items = sessions.Select(s => new AdminTownSquareSessionDto(
            s.Id, s.Status, s.RsvpOpensAt, s.RsvpClosesAt, s.ScheduledStartAt,
            s.CurrentRoundNumber, rsvpCounts.GetValueOrDefault(s.Id, 0), s.CreatedAt)).ToList();

        return Ok(new PagedResponse<AdminTownSquareSessionDto>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
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
}
