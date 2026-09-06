using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("scores")]
[Authorize]
[Produces("application/json")]
public class ScoresController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly HonourService _honours;

    public ScoresController(AppDbContext db, ScoreService score, HonourService honours)
    {
        _db = db;
        _score = score;
        _honours = honours;
    }

    [HttpGet("me")]
    [ProducesResponseType(typeof(ScoreResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyScore()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        return Ok(new ScoreResponse(
            user.TotalScore,
            user.GemTier,
            user.ReputationScore,
            _score.DailyMatchBudget(user),
            user.DailyMatchesUsed,
            Math.Max(0, _score.DailyMatchBudget(user) - user.DailyMatchesUsed)));
    }

    [HttpGet("me/detail")]
    [ProducesResponseType(typeof(ScoreDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyScoreDetail()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var (nextTier, nextThreshold, progressPct) = _score.TierProgress(user.TotalScore);
        int tierIndex = ScoreService.TierIndex(user.GemTier);

        var pendingReferral = await _db.Referrals
            .Where(r => r.InviterUserId == userId && r.InviterNotifiedAt == null)
            .OrderBy(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        var pendingReward = HonourService.ToDropped(pendingReferral?.InviterRewardItemId);

        var pendingShip = await _db.Ships
            .Where(s => s.ShipperUserId == userId && s.Status == "Sparked" && s.ShipperNotifiedAt == null)
            .OrderBy(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        var pendingShipReward = HonourService.ToDropped(pendingShip?.ShipperRewardItemId);

        return Ok(new ScoreDetailResponse(
            user.TotalScore,
            user.GemTier,
            user.ReputationScore,
            ScoreService.DisplayStreak(user.CurrentStreak, user.LastLoginDate, DateTime.UtcNow.Date),
            user.LongestStreak,
            tierIndex,
            tierIndex,
            nextTier,
            nextThreshold,
            progressPct,
            _score.DailyMatchBudget(user),
            pendingReward,
            pendingShipReward));
    }

    [HttpPost("me/notifications/ack")]
    [ProducesResponseType(typeof(AckNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AckRewardNotification([FromBody] AckNotificationDto req)
    {
        var userId = this.CurrentUserId();

        if (req.Kind == "referral")
        {
            var pending = await _db.Referrals
                .Where(r => r.InviterUserId == userId && r.InviterNotifiedAt == null)
                .OrderBy(r => r.CreatedAt)
                .FirstOrDefaultAsync();
            if (pending is null) return Ok(new AckNotificationResponse(false));

            pending.InviterNotifiedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new AckNotificationResponse(true));
        }

        if (req.Kind == "ship")
        {
            var pending = await _db.Ships
                .Where(s => s.ShipperUserId == userId && s.Status == "Sparked" && s.ShipperNotifiedAt == null)
                .OrderBy(s => s.CreatedAt)
                .FirstOrDefaultAsync();
            if (pending is null) return Ok(new AckNotificationResponse(false));

            pending.ShipperNotifiedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new AckNotificationResponse(true));
        }

        return this.BadRequestError("kind must be 'referral' or 'ship'", "invite.kind_invalid");
    }

    [HttpGet("me/history")]
    [ProducesResponseType(typeof(ScoreHistoryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyScoreHistory([FromQuery] DateTime? cursor, [FromQuery] Guid? cursorId, [FromQuery] int pageSize = 20)
    {
        var userId = this.CurrentUserId();
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.ScoreEvents.AsNoTracking().Where(e => e.UserId == userId);
        if (cursor is not null && cursorId is not null)
        {
            query = query.Where(e =>
                e.CreatedAt < cursor ||
                (e.CreatedAt == cursor && e.Id.CompareTo(cursorId.Value) < 0));
        }

        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .Take(pageSize + 1)
            .ToListAsync();

        bool hasMore = events.Count > pageSize;
        var page = events.Take(pageSize).ToList();
        DateTime? nextCursor = hasMore ? page[^1].CreatedAt : null;
        Guid? nextCursorId = hasMore ? page[^1].Id : null;

        return Ok(new ScoreHistoryResponse(
            page.Select(e => new ScoreEventDto(e.EventType, e.Delta, e.CreatedAt)).ToList(),
            nextCursor,
            nextCursorId));
    }

    [HttpGet("tiers")]
    [ProducesResponseType(typeof(TierThresholdsResponse), StatusCodes.Status200OK)]
    public IActionResult GetTiers()
    {
        var tiers = _score.GetTierTable()
            .Select(t => new TierThresholdDto(t.Tier, t.MinScore))
            .ToList();
        return Ok(new TierThresholdsResponse(tiers));
    }

    [HttpGet("leaderboard")]
    [ProducesResponseType(typeof(LeaderboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLeaderboard()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        // Group by cohort, not by the raw City string: Ulaanbaatar's districts (which is what GPS
        // resolves to, and what the district picker can store) all belong on the one capital board,
        // or every district that isn't the seed's bare "Ulaanbaatar" gets a lonely board of one.
        var cohort = MongoliaGeo.CohortCityNames(user.City);

        var top = await _db.Users.AsNoTracking()
            .Where(u => cohort.Contains(u.City))
            .OrderByDescending(u => u.TotalScore)
            .ThenBy(u => u.Id)
            .Take(50)
            .Select(u => new { u.Id, u.GemTier, u.TotalScore })
            .ToListAsync();

        int rank = 1;
        var entries = top.Select(u => new LeaderboardEntryDto(rank++, u.GemTier, u.TotalScore, u.Id == userId)).ToList();

        var mine = entries.FirstOrDefault(e => e.IsCurrentUser);
        int myRank;
        if (mine is not null)
        {
            myRank = mine.Rank;
        }
        else
        {
            myRank = 1 + await _db.Users.CountAsync(u => cohort.Contains(u.City) && u.TotalScore > user.TotalScore);
            entries.Add(new LeaderboardEntryDto(myRank, user.GemTier, user.TotalScore, true));
        }

        return Ok(new LeaderboardResponse(MongoliaGeo.CanonicalCity(user.City), entries, myRank));
    }

    [HttpPost("daily-login")]
    [ProducesResponseType(typeof(DailyLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DailyLogin()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var today = DateTime.UtcNow.Date;

        if (user.DailyMatchesResetAt.Date < today)
        {
            user.DailyMatchesUsed = 0;
            user.DailyMatchesResetAt = today;
        }

        var alreadyAwarded = await _db.ScoreEvents.AnyAsync(e =>
            e.UserId == userId &&
            e.EventType == "DailyLogin" &&
            e.CreatedAt >= today);

        if (alreadyAwarded)
        {
            await _db.SaveChangesAsync();

            return Ok(new DailyLoginResponse(0, "Already logged in today",
                ScoreService.DisplayStreak(user.CurrentStreak, user.LastLoginDate, today), user.LongestStreak));
        }

        int streak = ScoreService.ComputeStreak(user.CurrentStreak, user.LastLoginDate, today);
        user.CurrentStreak = streak;
        user.LongestStreak = Math.Max(user.LongestStreak, streak);
        user.LastLoginDate = today;

        bool bonus = streak % 7 == 0;
        int award = _score.Delta("DailyLogin") * Math.Min(streak, 7) + (bonus ? _score.WeeklyStreakBonus : 0);
        await _db.SaveChangesAsync();

        if (!await _score.TryAwardClaimedAsync(userId, "DailyLogin", award))
            return Ok(new DailyLoginResponse(0, "Already logged in today", user.CurrentStreak, user.LongestStreak));

        if (bonus) await _honours.GrantAsync(userId, "title_sevendawns", "daily_login");

        return Ok(new DailyLoginResponse(award, null, streak, user.LongestStreak, bonus));
    }
}
