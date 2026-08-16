using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// Development-only operational tooling. The hourly maintenance sweep
// (ghosting, daily-reset, deletion-anonymization, membership-expiry) was
// otherwise only reachable by waiting up to an hour or reaching into the
// internal method from a test — this gives local testing/ops a way to
// trigger it on demand. Returns 404 outside Development so it can never be
// hit in a real deployment.
[ApiController]
[Route("dev")]
[Authorize]
[Produces("application/json")]
public class DevController : ControllerBase
{
    private readonly DailyMaintenanceBackgroundService _sweep;
    private readonly IHostEnvironment _env;

    public DevController(DailyMaintenanceBackgroundService sweep, IHostEnvironment env)
    {
        _sweep = sweep;
        _env = env;
    }

    [HttpPost("run-maintenance-sweep")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RunMaintenanceSweep(CancellationToken ct)
    {
        if (!_env.IsDevelopment()) return NotFound();
        await _sweep.RunSweepAsync(ct);
        return Ok(new { ran = true });
    }
}
