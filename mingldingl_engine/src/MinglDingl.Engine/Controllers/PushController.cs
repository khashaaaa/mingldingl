using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("push")]
[Authorize]
[Produces("application/json")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    public PushController(AppDbContext db) => _db = db;

    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterPushTokenDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Token)) return this.BadRequestError("Token is required");

        var userId = this.CurrentUserId();
        var existing = await _db.PushTokens.FirstOrDefaultAsync(t => t.Token == req.Token);
        if (existing is null)
        {
            _db.PushTokens.Add(new PushToken { UserId = userId, Token = req.Token, Platform = req.Platform ?? "" });
        }
        else
        {
            existing.UserId = userId;
            existing.Platform = req.Platform ?? existing.Platform;
        }
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("unregister")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Unregister([FromBody] RegisterPushTokenDto req)
    {
        var token = await _db.PushTokens.FirstOrDefaultAsync(t => t.Token == req.Token);
        if (token is not null)
        {
            _db.PushTokens.Remove(token);
            await _db.SaveChangesAsync();
        }
        return Ok();
    }
}

public record RegisterPushTokenDto(string Token, string? Platform);
