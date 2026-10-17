using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Features.Payments;

/// The web page's own scheme: a half-hour token that reaches only /guild. Its key is derived from
/// the app's, but issuer, audience and key all differ, so neither token is accepted for the other.
public sealed class GuildAuth(IConfiguration config, IClock clock)
{
    public const string Scheme = "Guild";
    public const string Issuer = "mingl-guild";
    public const string Policy = "Guild";
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public static SymmetricSecurityKey Key(IConfiguration config)
    {
        var app = TokenIssuer.Key(config).Key;
        return new SymmetricSecurityKey(HMACSHA256.HashData(app, Encoding.UTF8.GetBytes("guild-web-v1")));
    }

    public GuildSession Issue(Guid accountId, string name)
    {
        var now = clock.UtcNow;
        var expires = now.Add(Lifetime);
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Issuer,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            Claims = new Dictionary<string, object> { [AppClaims.Sub] = accountId.ToString() },
            SigningCredentials = new SigningCredentials(Key(config), SecurityAlgorithms.HmacSha256),
        });
        return new GuildSession(token, expires, name);
    }
}
