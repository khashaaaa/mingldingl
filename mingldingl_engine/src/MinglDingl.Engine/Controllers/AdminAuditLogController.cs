using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/audit-log")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminAuditLogController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminAuditLogController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminAuditLogDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);
        var query = _db.AdminAuditLogs.AsNoTracking().OrderByDescending(l => l.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip(skip)
            .Take(safePageSize)
            .Select(l => new AdminAuditLogDto(l.Id, l.AdminUsername, l.Action, l.EntityType, l.EntityId, l.Details, l.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResponse<AdminAuditLogDto>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }
}
