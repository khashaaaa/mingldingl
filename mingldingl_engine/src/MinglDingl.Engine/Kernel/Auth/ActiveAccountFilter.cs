using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Kernel.Auth;

/// On every write: a suspended or deleted account may read itself (the app shows why), never change anything.
public sealed class ActiveAccountFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var id = http.User.AccountId();
        var status = await http.RequestServices.GetRequiredService<AppDb>().Set<Account>()
            .Where(a => a.Id == id).Select(a => (AccountStatus?)a.Status).SingleOrDefaultAsync(http.RequestAborted);
        return status switch
        {
            AccountStatus.Active => await next(ctx),
            AccountStatus.Suspended => throw new DomainException(403, "account.suspended", "This character has been cast out"),
            _ => throw new DomainException(403, "account.deleted", "This character no longer exists"),
        };
    }
}

public static class WriteEndpoints
{
    /// Signed in, active, and within the per-person write rate.
    public static RouteHandlerBuilder AsWrite(this RouteHandlerBuilder b) => b
        .RequireAuthorization()
        .AddEndpointFilter<ActiveAccountFilter>()
        .RequireRateLimiting(RateLimits.RateLimitPolicies.Writes);
}
