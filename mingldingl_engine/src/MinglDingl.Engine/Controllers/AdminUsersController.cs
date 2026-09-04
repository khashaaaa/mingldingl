using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/users")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AdminAuditService _audit;
    private readonly ScoreService _score;
    private readonly ConfigService _config;

    public AdminUsersController(AppDbContext db, AdminAuditService audit, ScoreService score, ConfigService config)
    {
        _db = db;
        _audit = audit;
        _score = score;
        _config = config;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminUserListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.DisplayName, term) ||
                EF.Functions.ILike(u.City, term) ||
                (u.PhoneNumber != null && EF.Functions.ILike(u.PhoneNumber, term)));
        }

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip(skip)
            .Take(safePageSize)
            .Select(u => new AdminUserListItemDto(
                u.Id, u.DisplayName, u.Age, u.City, u.GemTier, u.MembershipLevel,
                u.TotalScore, u.IsPaused, u.IsDeleted, u.IsBanned, u.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResponse<AdminUserListItemDto>(users, safePage, safePageSize, totalCount, skip + users.Count < totalCount));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var recentEvents = await _db.ScoreEvents.AsNoTracking()
            .Where(e => e.UserId == id)
            .OrderByDescending(e => e.CreatedAt)
            .Take(20)
            .Select(e => new ScoreEventDto(e.EventType, e.Delta, e.CreatedAt))
            .ToListAsync();

        var blockedByThem = await _db.BlockedUsers.AsNoTracking()
            .Where(b => b.BlockerId == id)
            .Join(_db.Users.AsNoTracking(), b => b.BlockedId, u => u.Id,
                (b, u) => new AdminBlockRelationDto(u.Id, u.DisplayName, b.CreatedAt))
            .ToListAsync();

        var blockedThem = await _db.BlockedUsers.AsNoTracking()
            .Where(b => b.BlockedId == id)
            .Join(_db.Users.AsNoTracking(), b => b.BlockerId, u => u.Id,
                (b, u) => new AdminBlockRelationDto(u.Id, u.DisplayName, b.CreatedAt))
            .ToListAsync();

        var recentMatches = await _db.Matches.AsNoTracking()
            .Include(m => m.Initiator)
            .Include(m => m.Receiver)
            .Where(m => m.InitiatorId == id || m.ReceiverId == id)
            .OrderByDescending(m => m.LastMessageAt ?? m.CreatedAt)
            .Take(20)
            .Select(m => new AdminUserMatchDto(
                m.Id,
                m.InitiatorId == id ? m.ReceiverId : m.InitiatorId,
                m.InitiatorId == id ? m.Receiver.DisplayName : m.Initiator.DisplayName,
                m.Status, m.MessageCount, m.CreatedAt,
                m.FlameRiteProposedById, m.FlameRiteProposedAt, m.FlameRiteAcceptedAt, m.FlameRiteCompletedAt))
            .ToListAsync();

        var ships = await _db.Ships.AsNoTracking()
            .Where(s => s.ShipperUserId == id || s.SlotAUserId == id || s.SlotBUserId == id)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new AdminUserShipDto(
                s.Id,
                s.ShipperUserId == id ? "Shipper" : s.SlotAUserId == id ? "SlotA" : "SlotB",
                s.Status, s.CreatedAt))
            .ToListAsync();

        var townSquareRsvps = await _db.TownSquareRsvps.AsNoTracking()
            .Include(r => r.Session)
            .Where(r => r.UserId == id)
            .OrderByDescending(r => r.RsvpAt)
            .Take(20)
            .Select(r => new AdminUserTownSquareRsvpDto(r.SessionId, r.Session.ScheduledStartAt, r.Session.Status, r.RsvpAt))
            .ToListAsync();

        return Ok(new AdminUserDetailDto(
            user.Id, user.PhoneNumber, user.DisplayName, user.Age, user.Gender, user.City, user.Bio,
            user.PhotoUrls, user.HasKids, user.SmokingHabit, user.DrinkingHabit, user.Religion, user.Lifestyle,
            user.TotalScore, user.GemTier, user.ReputationScore, user.MembershipLevel, user.MembershipExpiresAt,
            ScoreService.DisplayStreak(user.CurrentStreak, user.LastLoginDate, DateTime.UtcNow.Date),
            user.LongestStreak, user.Oath, user.OathSwornAt, user.OathProven, user.NoShowFlagCount,
            user.IsPaused, user.IsDeleted, user.IsBanned, user.BannedAt, user.BanReason,
            user.DeletionRequestedAt, user.CreatedAt, recentEvents, blockedByThem, blockedThem,
            recentMatches, ships, townSquareRsvps));
    }

    [HttpGet("deletion-requests")]
    [ProducesResponseType(typeof(IReadOnlyList<AdminDeletionRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDeletionRequests()
    {
        var pending = await _db.Users.AsNoTracking()
            .Where(u => u.DeletionRequestedAt != null && !u.IsDeleted)
            .OrderBy(u => u.DeletionRequestedAt)
            .Select(u => new { u.Id, u.DisplayName, u.City, DeletionRequestedAt = u.DeletionRequestedAt!.Value })
            .ToListAsync();

        var graceDays = (int)DailyMaintenanceBackgroundService.GracePeriodFor(_config).TotalDays;
        var now = DateTime.UtcNow;
        var result = pending
            .Select(u => new AdminDeletionRequestDto(
                u.Id, u.DisplayName, u.City, u.DeletionRequestedAt,
                Math.Max(0, graceDays - (now - u.DeletionRequestedAt).Days)))
            .ToList();

        return Ok(result);
    }

    [HttpPost("{id}/ban")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BanUser(Guid id, [FromBody] AdminBanUserRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        user.IsBanned = true;
        user.BannedAt = DateTime.UtcNow;
        user.BanReason = req.Reason;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "BanUser", "User", id.ToString(), req.Reason);

        return await GetUser(id);
    }

    [HttpPost("{id}/unban")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnbanUser(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        user.IsBanned = false;
        user.BannedAt = null;
        user.BanReason = null;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "UnbanUser", "User", id.ToString());

        return await GetUser(id);
    }

    [HttpPost("{id}/cancel-deletion")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelDeletion(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        user.DeletionRequestedAt = null;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "CancelDeletion", "User", id.ToString());

        return await GetUser(id);
    }

    [HttpPost("{id}/reset-noshow")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetNoShow(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var previous = user.NoShowFlagCount;
        user.NoShowFlagCount = 0;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "ResetNoShow", "User", id.ToString(), $"was {previous}");

        return await GetUser(id);
    }

    [HttpPost("{id}/adjust-score")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustScore(Guid id, [FromBody] AdminAdjustScoreRequest req)
    {
        var exists = await _db.Users.AsNoTracking().AnyAsync(u => u.Id == id);
        if (!exists) return this.NotFoundError("User not found", "user.not_found");

        await _score.AwardWithDeltaAsync(id, "AdminAdjustment", req.Delta);
        await _audit.LogAsync(User, "AdjustScore", "User", id.ToString(), $"{(req.Delta >= 0 ? "+" : "")}{req.Delta}: {req.Reason}");

        return await GetUser(id);
    }

    [HttpGet("export")]
    [Produces("text/csv")]
    public async Task<IActionResult> Export([FromQuery] string? search)
    {
        var query = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.DisplayName, term) ||
                EF.Functions.ILike(u.City, term) ||
                (u.PhoneNumber != null && EF.Functions.ILike(u.PhoneNumber, term)));
        }
        var rows = await query.OrderByDescending(u => u.CreatedAt).ToListAsync();

        var csv = CsvWriter.Write(
            ["DisplayName", "Age", "City", "GemTier", "MembershipLevel", "TotalScore", "IsPaused", "IsDeleted", "IsBanned", "CreatedAt"],
            rows.Select(u => new[]
            {
                u.DisplayName, u.Age.ToString(), u.City, u.GemTier, u.MembershipLevel, u.TotalScore.ToString(),
                u.IsPaused.ToString(), u.IsDeleted.ToString(), u.IsBanned.ToString(), u.CreatedAt.ToString("O"),
            }));

        await _audit.LogAsync(User, "ExportUsers", "User", null, $"{rows.Count} rows");
        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "users.csv");
    }
}
