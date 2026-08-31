using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("[controller]")]
[Produces("application/json")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;

    public HealthController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Get()
    {
        try
        {
            await _db.Database.ExecuteSqlRawAsync("SELECT 1");
            return Ok(new HealthResponse("ok"));
        }
        catch
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new HealthResponse("unhealthy"));
        }
    }
}
