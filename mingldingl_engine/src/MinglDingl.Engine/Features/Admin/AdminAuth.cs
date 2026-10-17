using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;

namespace MinglDingl.Engine.Features.Admin;

/// PBKDF2-SHA256, "{iterations}.{salt}.{hash}".
public static class AdminPasswordHasher
{
    private const int Iterations = 210_000;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations) || iterations <= 0) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            if (salt.Length == 0 || expected.Length == 0) return false;
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }
}

/// One hard-coded admin; a separate signing key and issuer from app sessions, never the default scheme.
public sealed class AdminAuth(IConfiguration config, IClock clock, IMemoryCache cache)
{
    public const string Scheme = "AdminBearer";
    public const string Issuer = "mingl-admin";
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);
    private static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);

    public static SymmetricSecurityKey Key(IConfiguration config)
    {
        var raw = config["Admin:JwtSigningKey"];
        if (string.IsNullOrEmpty(raw) || Encoding.UTF8.GetByteCount(raw) < 32)
            throw new InvalidOperationException("Admin:JwtSigningKey must be at least 32 bytes");
        if (raw == config["Auth:SigningKey"])
            throw new InvalidOperationException("Admin:JwtSigningKey must differ from Auth:SigningKey");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(raw));
    }

    public AdminLoginResponse Login(string username, string password, string ip)
    {
        var maxFailures = config.GetValue("RateLimits:AdminLoginPer15Min", 5);
        var key = "admin-fail:" + ip;
        var now = clock.UtcNow;
        if (cache.TryGetValue(key, out (int Count, DateTimeOffset Since) fails) && now - fails.Since > FailureWindow)
        {
            cache.Remove(key);
            fails = default;
        }
        if (fails.Count >= maxFailures)
            throw new DomainException(429, "admin.login_throttled", "Too many tries — wait 15 minutes");

        var expectedUser = config["Admin:Username"] ?? "";
        var hash = config["Admin:PasswordHash"] ?? "";
        var userOk = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(username), Encoding.UTF8.GetBytes(expectedUser));
        var passOk = hash.Length > 0 && AdminPasswordHasher.Verify(password, hash);
        if (expectedUser.Length == 0 || !userOk || !passOk)
        {
            cache.Set(key, (fails.Count + 1, fails.Count == 0 ? now : fails.Since), FailureWindow);
            throw new DomainException(401, "admin.bad_login", "Wrong username or password");
        }
        cache.Remove(key);

        var expires = now.Add(Lifetime);
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Issuer,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            Claims = new Dictionary<string, object> { ["sub"] = "admin", ["role"] = "admin" },
            SigningCredentials = new SigningCredentials(Key(config), SecurityAlgorithms.HmacSha256),
        });
        return new AdminLoginResponse(token, expires);
    }
}
