using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/reports")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ReportService _reports;
    private readonly AdminAuditService _audit;

    public AdminReportsController(AppDbContext db, ReportService reports, AdminAuditService audit)
    {
        _db = db;
        _reports = reports;
        _audit = audit;
    }

    /// <summary>
    /// The moderation queue. Defaults to what is still open, because that is the only view with
    /// work in it; the resolved ones stay readable so a pattern across reporters is visible.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminReportListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListReports(
        [FromQuery] string? status = ReportOutcomes.Pending,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.UserReports.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(r => r.Status == status);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip(skip)
            .Take(safePageSize)
            .Select(r => new AdminReportListItemDto(
                r.Id,
                r.ReporterId,
                r.Reporter!.DisplayName,
                r.ReportedUserId,
                r.ReportedUser!.DisplayName,
                r.ReportedUser.IsBanned,
                r.Reason,
                r.Details,
                r.Status,
                r.MatchId,
                r.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResponse<AdminReportListItemDto>(
            items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    /// <summary>Open reports, for the dashboard badge.</summary>
    [HttpGet("pending-count")]
    [ProducesResponseType(typeof(PendingReportCountDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> PendingCount() =>
        Ok(new PendingReportCountDto(
            await _db.UserReports.CountAsync(r => r.Status == ReportOutcomes.Pending)));

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AdminReportDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReport(Guid id)
    {
        var report = await _db.UserReports.AsNoTracking()
            .Include(r => r.Reporter)
            .Include(r => r.ReportedUser)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (report is null) return this.NotFoundError("Report not found", "report.not_found");

        // How often this person has been reported, and by how many different people. One report is
        // a complaint; the same complaint from five reporters is the thing worth acting on.
        var against = await _db.UserReports.AsNoTracking()
            .Where(r => r.ReportedUserId == report.ReportedUserId)
            .Select(r => new { r.ReporterId, r.Status })
            .ToListAsync();

        return Ok(new AdminReportDetailDto(
            report.Id,
            report.ReporterId,
            report.Reporter?.DisplayName ?? "",
            report.ReportedUserId,
            report.ReportedUser?.DisplayName ?? "",
            report.ReportedUser?.IsBanned ?? false,
            report.ReportedUser?.PhotoUrls ?? [],
            report.Reason,
            report.Details,
            report.Status,
            report.MatchId,
            report.ReviewNotes,
            report.ReviewedBy,
            report.ReviewedAt,
            report.CreatedAt,
            against.Count,
            against.Select(r => r.ReporterId).Distinct().Count(),
            against.Count(r => r.Status == ReportOutcomes.Pending)));
    }

    /// <summary>
    /// Closes one report. <c>Penalised</c> applies the <c>ReportPenalty</c> score delta and
    /// <c>Banned</c> suspends the account and ends its live conversations; both are deliberately
    /// an admin's decision rather than an automatic consequence of being reported.
    /// </summary>
    [HttpPost("{id}/resolve")]
    [ProducesResponseType(typeof(AdminReportDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] AdminResolveReportRequest req)
    {
        var reviewer = User.Identity?.Name;
        var report = await _reports.ResolveAsync(id, req.Outcome, req.Notes, reviewer);
        await _audit.LogAsync(User, $"ResolveReport:{req.Outcome}", "UserReport", id.ToString(), req.Notes);
        return await GetReport(report.Id);
    }
}
