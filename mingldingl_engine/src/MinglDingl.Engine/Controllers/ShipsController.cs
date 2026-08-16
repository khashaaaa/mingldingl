using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("ships")]
[Authorize]
[Produces("application/json")]
public class ShipsController : ControllerBase
{
    private readonly ShipService _ships;
    private readonly AppDbContext _db;

    public ShipsController(ShipService ships, AppDbContext db)
    {
        _ships = ships;
        _db = db;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateShipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateShipRequest req)
    {
        var userId = this.CurrentUserId();
        var (success, error, slotACode, slotBCode) = await _ships.CreateAsync(userId, req.SlotAPhoneNumber, req.SlotBPhoneNumber);
        if (!success) return this.BadRequestError(error ?? "Could not weave this thread");
        return Ok(new CreateShipResponse(true, null, slotACode, slotBCode));
    }

    [HttpGet("pending")]
    [ProducesResponseType(typeof(List<PendingShipResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending()
    {
        var userId = this.CurrentUserId();
        var pending = await _db.Ships
            .Where(s => s.Status == "Pending" &&
                ((s.SlotAUserId == userId && s.SlotAOptIn == "PendingOptIn") ||
                 (s.SlotBUserId == userId && s.SlotBOptIn == "PendingOptIn")))
            .Join(_db.Users, s => s.ShipperUserId, u => u.Id, (s, u) => new { s.Id, u.DisplayName })
            .ToListAsync();

        return Ok(pending.Select(p => new PendingShipResponse(p.Id, p.DisplayName)).ToList());
    }

    [HttpPost("{id}/respond")]
    [ProducesResponseType(typeof(RespondToShipResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Respond(Guid id, [FromBody] RespondToShipRequest req)
    {
        var userId = this.CurrentUserId();
        bool sparked = await _ships.RespondAsync(userId, id, req.Accept);
        return Ok(new RespondToShipResponse(sparked));
    }
}
