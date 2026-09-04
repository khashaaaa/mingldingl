using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("admin/ops")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminOpsController : ControllerBase
{
    private readonly DailyMaintenanceBackgroundService _sweep;
    private readonly AdminAuditService _audit;
    private readonly MembershipCatalog _catalog;
    public AdminOpsController(DailyMaintenanceBackgroundService sweep, AdminAuditService audit, MembershipCatalog catalog)
    {
        _sweep = sweep;
        _audit = audit;
        _catalog = catalog;
    }

    [HttpPost("run-maintenance-sweep")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RunMaintenanceSweep(CancellationToken ct)
    {
        await _sweep.RunSweepAsync(ct);
        await _audit.LogAsync(User, "RunMaintenanceSweep", "System", null);
        return Ok(new { ran = true });
    }

    [HttpGet("pricing")]
    [ProducesResponseType(typeof(List<MembershipTierResponse>), StatusCodes.Status200OK)]
    public IActionResult GetPricing() => Ok(_catalog.Tiers().ToList());
}
