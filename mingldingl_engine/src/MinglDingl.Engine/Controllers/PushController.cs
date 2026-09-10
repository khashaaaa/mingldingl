using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("push")]
[Authorize]
[Produces("application/json")]
public partial class PushController : ControllerBase
{
    /// <summary>
    /// Devices one account may hold tokens for. Registration is client-driven, so without a cap a
    /// single account can grow the table without bound and every push it earns fans out across all
    /// of them. The oldest is evicted rather than the newest refused: the newest is the device the
    /// person is actually holding.
    /// </summary>
    private const int MaxTokensPerUser = 10;

    /// <summary>
    /// Expo's token shape. Anything else is a string this engine would hand to Expo only to be
    /// told it is invalid, so it is refused at the door rather than stored.
    /// </summary>
    [GeneratedRegex(@"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_\-]+\]$")]
    private static partial Regex ExpoTokenPattern();

    private readonly AppDbContext _db;
    public PushController(AppDbContext db) => _db = db;

    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterPushTokenDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Token)) return this.BadRequestError("Token is required", "auth.token_required");
        if (!ExpoTokenPattern().IsMatch(req.Token))
            return this.BadRequestError("Not an Expo push token", "push.token_invalid");

        var userId = this.CurrentUserId();
        var existing = await _db.PushTokens.FirstOrDefaultAsync(t => t.Token == req.Token);
        if (existing is null)
        {
            // Two people can share a phone, so a token moving between accounts is legitimate — but
            // only the account that currently holds it may be pushed to, which is why this reassigns
            // rather than adding a second row.
            _db.PushTokens.Add(new PushToken { UserId = userId, Token = req.Token, Platform = req.Platform ?? "" });

            var mine = await _db.PushTokens
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .Skip(MaxTokensPerUser - 1)
                .ToListAsync();
            if (mine.Count > 0) _db.PushTokens.RemoveRange(mine);
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
        // Scoped to the caller. Matching on the token value alone let any authenticated account
        // silence any device whose token it could name, and every token is handed to a client.
        var userId = this.CurrentUserId();
        var token = await _db.PushTokens.FirstOrDefaultAsync(t => t.Token == req.Token && t.UserId == userId);
        if (token is not null)
        {
            _db.PushTokens.Remove(token);
            await _db.SaveChangesAsync();
        }
        return Ok();
    }
}

public record RegisterPushTokenDto(
    [MaxLength(FieldLimits.PushToken)] string Token,
    [MaxLength(FieldLimits.ShortLabel)] string? Platform);
