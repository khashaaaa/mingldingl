using System.Security.Claims;

namespace MinglDingl.Engine.Kernel.Auth;

public static class AppClaims
{
    public const string Scheme = "App";
    public const string Issuer = "mingl-app";
    public const string Sub = "sub";
    public const string Sid = "sid";

    public static Guid AccountId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(Sub)!);
    public static Guid SessionId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(Sid)!);
}
