using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

[ApiController]
[Route("admin/auth")]
[Produces("application/json")]
public class AdminAuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly LoginThrottleService _throttle;

    public AdminAuthController(IConfiguration config, LoginThrottleService throttle)
    {
        _config = config;
        _throttle = throttle;
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(AdminLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public IActionResult Login([FromBody] AdminLoginRequest req)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        // This endpoint is anonymous and guards the only admin account, so it needs a lockout —
        // without one it is brute-forceable at line speed.
        if (_throttle.RetryAfter(req.Username, ip) is TimeSpan wait)
        {
            Response.Headers.RetryAfter = ((int)Math.Ceiling(wait.TotalSeconds)).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { error = "Too many failed attempts. Try again later." });
        }

        var username = _config["Admin:Username"];
        var passwordHash = _config["Admin:PasswordHash"];
        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(passwordHash))
            return Unauthorized(new { error = "Admin login is not configured." });

        if (req.Username != username || !AdminPasswordHasher.Verify(req.Password, passwordHash))
        {
            _throttle.RecordFailure(req.Username, ip);
            return Unauthorized(new { error = "Invalid username or password." });
        }

        _throttle.RecordSuccess(req.Username, ip);

        var signingKey = _config["Admin:JwtSigningKey"]
            ?? throw new InvalidOperationException("Admin:JwtSigningKey is not configured.");
        var expiresAt = DateTime.UtcNow.AddHours(12);

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: [new Claim(ClaimTypes.Name, username)],
            expires: expiresAt,
            signingCredentials: credentials);

        return Ok(new AdminLoginResponse(new JwtSecurityTokenHandler().WriteToken(token), expiresAt));
    }
}
