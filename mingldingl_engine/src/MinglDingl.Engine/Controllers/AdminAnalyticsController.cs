using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/analytics")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminAnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MembershipCatalog _catalog;
    public AdminAnalyticsController(AppDbContext db, MembershipCatalog catalog)
    {
        _db = db;
        _catalog = catalog;
    }

    [HttpGet("overview")]
    [ProducesResponseType(typeof(AdminAnalyticsOverviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview()
    {
        var totalUsers = await _db.Users.CountAsync();
        var deletedUsers = await _db.Users.CountAsync(u => u.IsDeleted);
        var pausedUsers = await _db.Users.CountAsync(u => u.IsPaused && !u.IsDeleted);
        var activeUsers = totalUsers - deletedUsers - pausedUsers;

        var byMembership = await _db.Users
            .GroupBy(u => u.MembershipLevel)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToListAsync();

        var byGemTier = await _db.Users
            .GroupBy(u => u.GemTier)
            .Select(g => new { Tier = g.Key, Count = g.Count() })
            .ToListAsync();

        var since = DateTime.UtcNow.Date.AddDays(-29);
        var signupsRaw = await _db.Users
            .Where(u => u.CreatedAt >= since)
            .GroupBy(u => u.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToListAsync();
        var signupsByDate = signupsRaw.ToDictionary(g => DateOnly.FromDateTime(g.Date), g => g.Count);
        var signups = Enumerable.Range(0, 30)
            .Select(i => DateOnly.FromDateTime(since.AddDays(i)))
            .Select(d => new DailyCountDto(d, signupsByDate.GetValueOrDefault(d)))
            .ToList();

        var totalMatches = await _db.Matches.CountAsync();
        var totalMessages = await _db.Messages.CountAsync();

        var scoreEventsRaw = await _db.ScoreEvents
            .Where(e => e.CreatedAt >= since)
            .GroupBy(e => e.EventType)
            .Select(g => new { EventType = g.Key, Count = g.Count() })
            .ToListAsync();
        var scoreEvents = scoreEventsRaw
            .OrderByDescending(e => e.Count)
            .Select(e => new EventTypeCountDto(e.EventType, e.Count))
            .ToList();

        var oathSwornUsers = await _db.Users.CountAsync(u => u.OathSwornAt != null);
        var oathProvenUsers = await _db.Users.CountAsync(u => u.OathProven);
        var noShowFlaggedUsers = await _db.Users.CountAsync(u => u.NoShowFlagCount > 0);
        var flameRitesCompleted = await _db.Matches.CountAsync(m => m.FlameRiteCompletedAt != null);
        var shipsSparked = await _db.Ships.CountAsync(s => s.Status == "Sparked");
        var townSquareSessions = await _db.TownSquareSessions.CountAsync();

        var priceByLevel = _catalog.Tiers().ToDictionary(t => t.Level, t => t.MonthlyPriceMnt ?? 0);
        var estimatedRevenue = byMembership.Sum(m => m.Count * priceByLevel.GetValueOrDefault(m.Level));

        return Ok(new AdminAnalyticsOverviewResponse(
            totalUsers, activeUsers, pausedUsers, deletedUsers,
            byMembership.ToDictionary(m => m.Level, m => m.Count),
            byGemTier.ToDictionary(t => t.Tier, t => t.Count),
            signups, totalMatches, totalMessages, scoreEvents, estimatedRevenue,
            oathSwornUsers, oathProvenUsers, noShowFlaggedUsers, flameRitesCompleted, shipsSparked, townSquareSessions));
    }
}
