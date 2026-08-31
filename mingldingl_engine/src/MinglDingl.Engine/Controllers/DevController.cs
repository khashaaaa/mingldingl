using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
