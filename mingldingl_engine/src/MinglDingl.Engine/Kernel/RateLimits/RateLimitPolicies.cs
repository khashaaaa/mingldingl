using System.Threading.RateLimiting;
using MinglDingl.Engine.Kernel.Errors;

namespace MinglDingl.Engine.Kernel.RateLimits;

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Refresh = "refresh";
    public const string Writes = "writes";
    public const string QPayCallback = "qpay-callback";
    public const string AdminLogin = "admin-login";

    public static IServiceCollection AddRateLimits(this IServiceCollection s, IConfiguration config)
    {
        var authPerMinute = config.GetValue("RateLimits:AuthPerMinute", 10);
        var refreshPerMinute = config.GetValue("RateLimits:RefreshPerMinute", 60);
        var adminLoginPerMinute = config.GetValue("RateLimits:AdminLoginPerMinute", 5);
        s.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
                await ctx.HttpContext.Response.WriteAsJsonAsync(new ErrorBody("rate_limited", "Too many tries — wait a minute"), ct);
            o.AddPolicy(Auth, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // Every open app refreshes about every 15 minutes, and a carrier's NAT puts many phones behind
            // one address: looser than sign-in, only enough to stop a flood (the tokens cannot be guessed).
            o.AddPolicy(Refresh, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = refreshPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // One admin, typing: a handful a minute per address, before the 15-minute lockout even counts.
            o.AddPolicy(AdminLogin, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = adminLoginPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // QPay sends one callback per payment; a handful a minute per invoice is plenty.
            o.AddPolicy(QPayCallback, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Request.Query["invoice"].ToString(),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
            o.AddPolicy(Writes, ctx =>
            {
                var who = ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var limit = config.GetValue<int?>("RateLimits:WritesPerMinuteOverride")
                    ?? ctx.RequestServices.GetRequiredService<Config.IConfig>().Int(Config.ConfigKeys.WritesPerMinute);
                return RateLimitPartition.GetFixedWindowLimiter(who,
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) });
            });
        });
        return s;
    }
}
