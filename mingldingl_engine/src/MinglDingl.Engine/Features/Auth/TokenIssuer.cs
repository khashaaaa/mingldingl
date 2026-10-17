using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Features.Auth;

public sealed class TokenIssuer(IConfiguration config, IClock clock)
{
    public static readonly TimeSpan AccessLifetime = TimeSpan.FromMinutes(15);

    public static SymmetricSecurityKey Key(IConfiguration config)
    {
        var raw = config["Auth:SigningKey"];
        if (string.IsNullOrEmpty(raw) || Encoding.UTF8.GetByteCount(raw) < 32)
            throw new InvalidOperationException("Auth:SigningKey must be at least 32 bytes");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(raw));
    }

    /// A new access token and a new refresh token for this device. The refresh token's hash is
    /// returned for storage; the token itself only ever goes to the device.
    public (SessionPair Pair, string RefreshHash) Issue(DeviceSession device)
    {
        var now = clock.UtcNow;
        var expires = now.Add(AccessLifetime);
        var access = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = AppClaims.Issuer,
            Audience = AppClaims.Issuer,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                [AppClaims.Sub] = device.AccountId.ToString(),
                [AppClaims.Sid] = device.Id.ToString(),
            },
            SigningCredentials = new SigningCredentials(Key(config), SecurityAlgorithms.HmacSha256),
        });
        var refresh = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        return (new SessionPair(access, expires, refresh, device.AccountId), Hash(refresh));
    }

    public static string Hash(string refreshToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
}
