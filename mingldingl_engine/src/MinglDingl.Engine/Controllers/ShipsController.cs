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
    private readonly ConfigService _config;

    public ShipsController(ShipService ships, AppDbContext db, ConfigService config)
    {
        _ships = ships;
        _db = db;
        _config = config;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateShipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateShipRequest req)
    {
        if (!_config.GetBool("ships.enabled", true))
            return this.NotFoundError("Fated Threads are not open", "ship.disabled");

        var userId = this.CurrentUserId();
        var (success, error, errorCode, slotACode, slotBCode) = await _ships.CreateAsync(userId, req.SlotAPhoneNumber, req.SlotBPhoneNumber);
        if (!success) return this.BadRequestError(error ?? "Could not weave this thread", errorCode ?? "ship.create_failed");
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
