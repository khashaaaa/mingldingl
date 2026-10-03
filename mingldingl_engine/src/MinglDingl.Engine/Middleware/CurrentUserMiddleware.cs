using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

public class CurrentUserMiddleware
{
    private readonly RequestDelegate _next;

    public CurrentUserMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userId = ExtractUserId(context.User);
        if (!userId.HasValue)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(
                new ErrorResponse("Invalid authentication token.", "auth.token_invalid"));
            return;
        }

        var phone = ExtractPhone(context.User);
        var (resolvedUserId, standing) = await ResolveAsync(context, userId.Value, phone);
        if (standing?.IsDeleted == true)
        {
            // The sweep anonymised this row, but the identity that created it still holds a valid
            // JWT. Letting it through meant POST /users simply refilled the "deleted" account.
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(
                new ErrorResponse("This account has been deleted.", "account.deleted"));
            return;
        }
        if (standing?.IsBanned == true)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            // The same {Error, Code} shape every controller returns. Writing a bare `error` here
            // meant the one response the app most needs to explain — you have been suspended —
            // was the one it could not map to localised copy.
            await context.Response.WriteAsJsonAsync(
                new ErrorResponse("This account has been suspended.", "account.suspended"));
            return;
        }

        context.Items["UserId"] = resolvedUserId;
        context.Items["PhoneNumber"] = phone;
        await _next(context);
    }

    private sealed record Standing(Guid Id, bool IsBanned, bool IsDeleted);

    /// <summary>
    /// A returning user signs in through a fresh anonymous Supabase identity every time, so an auth
    /// id with no account of its own may stand for an existing one. The only admissible link is a
    /// verify.mn proof this identity has claimed. The JWT's <c>user_metadata.phone</c> is written by
    /// the client (<c>PUT /auth/v1/user</c> with the anon key) and is never consulted while
    /// verification is configured — trusting it let anyone become any user by typing their number.
    /// <para>
    /// The account's standing is read in the same query that finds it. This runs on every
    /// authenticated request, and resolving first and reading standing after cost a returning user
    /// four sequential round trips before any controller ran.
    /// </para>
    /// </summary>
    private static async Task<(Guid UserId, Standing? Standing)> ResolveAsync(HttpContext context, Guid authId, string? phone)
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var own = await ToStanding(db.Users.AsNoTracking().Where(u => u.Id == authId));
        if (own is not null) return (authId, own);

        var verify = context.RequestServices.GetRequiredService<VerifyMnClient>();
        IQueryable<User>? alias = verify.IsConfigured
            ? PhoneVerificationService.AliasedAccounts(db, authId)
            // Without verify.mn there is no proof to check, so Development keeps the metadata phone as
            // the only handle a test harness has — the same relaxation POST /users makes when unconfigured.
            : phone is null ? null : db.Users.AsNoTracking().Where(u => u.PhoneNumber == phone);
        var aliased = alias is null ? null : await ToStanding(alias);
        return aliased is null ? (authId, null) : (aliased.Id, aliased);
    }

    private static Task<Standing?> ToStanding(IQueryable<User> users) =>
        users.Select(u => new Standing(u.Id, u.IsBanned, u.IsDeleted)).FirstOrDefaultAsync();

    public static Guid? ExtractUserId(ClaimsPrincipal principal)
    {
        var sub = principal.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    public static string? ExtractPhone(ClaimsPrincipal principal)
    {
        var metadata = principal.FindFirstValue("user_metadata");
        if (string.IsNullOrEmpty(metadata)) return null;
        try
        {
            using var doc = JsonDocument.Parse(metadata);
            return doc.RootElement.TryGetProperty("phone", out var p) ? p.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
