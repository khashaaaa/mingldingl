using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/ships")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminShipsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminShipsController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminShipListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListShips([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.Ships.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(s => s.Status == status);

        var totalCount = await query.CountAsync();
        var ships = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip(skip)
            .Take(safePageSize)
            .ToListAsync();

        var userIds = ships
            .SelectMany(s => new[] { s.ShipperUserId, s.SlotAUserId, s.SlotBUserId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var names = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        var items = ships.Select(s => new AdminShipListItemDto(
            s.Id, s.Status, s.ShipperUserId, names.GetValueOrDefault(s.ShipperUserId, "(unknown)"),
            s.SlotAUserId, s.SlotAUserId.HasValue ? names.GetValueOrDefault(s.SlotAUserId.Value) : null, s.SlotAOptIn,
            s.SlotBUserId, s.SlotBUserId.HasValue ? names.GetValueOrDefault(s.SlotBUserId.Value) : null, s.SlotBOptIn,
            s.ResultMatchId, s.CreatedAt)).ToList();

        return Ok(new PagedResponse<AdminShipListItemDto>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }
}
