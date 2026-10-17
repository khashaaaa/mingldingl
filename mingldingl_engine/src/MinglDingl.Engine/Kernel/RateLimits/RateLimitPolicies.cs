using System.Threading.RateLimiting;
using MinglDingl.Engine.Kernel.Errors;

namespace MinglDingl.Engine.Kernel.RateLimits;

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Writes = "writes";

    public static IServiceCollection AddRateLimits(this IServiceCollection s, IConfiguration config)
    {
        var authPerMinute = config.GetValue("RateLimits:AuthPerMinute", 10);
        s.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
                await ctx.HttpContext.Response.WriteAsJsonAsync(new ErrorBody("rate_limited", "Too many tries — wait a minute"), ct);
            o.AddPolicy(Auth, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1) }));
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
