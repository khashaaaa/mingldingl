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

    public AdminAuthController(IConfiguration config) => _config = config;

    [HttpPost("login")]
    [ProducesResponseType(typeof(AdminLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Login([FromBody] AdminLoginRequest req)
    {
        var username = _config["Admin:Username"];
        var passwordHash = _config["Admin:PasswordHash"];
        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(passwordHash))
            return Unauthorized(new { error = "Admin login is not configured." });

        if (req.Username != username || !AdminPasswordHasher.Verify(req.Password, passwordHash))
            return Unauthorized(new { error = "Invalid username or password." });

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
