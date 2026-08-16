using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// Admin-gated counterpart to DevController's run-maintenance-sweep (which is
// 404'd outside Development) — an admin should be able to trigger this in
// any environment, not just locally. Pricing is read-only here: there's no
// DB-backed override for MembershipPricing today (it's a pure function of
// each tier's hardcoded MonthlyPriceMnt), so "editing" it would mean
// converting that to persisted config first — out of scope for this pass.
// Feature flags: no such system exists anywhere in the engine today: no
// flag storage, no evaluation logic. Building toggleable flags here would
// mean inventing that whole subsystem from scratch, not just admin plumbing
// over something that exists — deliberately not attempted in this pass.
[ApiController]
[Route("admin/ops")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminOpsController : ControllerBase
{
    private readonly DailyMaintenanceBackgroundService _sweep;
    private readonly AdminAuditService _audit;
    public AdminOpsController(DailyMaintenanceBackgroundService sweep, AdminAuditService audit)
    {
        _sweep = sweep;
        _audit = audit;
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
    public IActionResult GetPricing() => Ok(MembershipController.AllTiers);
}
