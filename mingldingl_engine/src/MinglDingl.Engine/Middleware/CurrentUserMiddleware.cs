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
        // Anonymous requests (no/invalid JWT) are left alone here — [Authorize]
        // endpoints already get rejected by the authorization middleware that
        // runs after this one, and public endpoints (health checks, etc.)
        // don't read Items["UserId"] at all.
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userId = ExtractUserId(context.User);
        if (!userId.HasValue)
        {
            // A JWT that passed signature validation but has no parseable
            // "sub" claim. Every [Authorize] controller reads
            // Items["UserId"] with `(Guid)HttpContext.Items["UserId"]!`, which
            // throws NullReferenceException if we let this through — fail
            // here with the correct 401 instead of a misleading 500.
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "Invalid authentication token." });
            return;
        }

        var phone = ExtractPhone(context.User);
        var resolvedUserId = await ResolveUserIdAsync(context, userId.Value, phone);

        // Admin moderation action (mingldingl_control) — rejected here, not
        // just hidden from discovery like IsPaused. A cheap PK lookup, not
        // worth caching for this app's traffic.
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var isBanned = await db.Users.AsNoTracking()
            .Where(u => u.Id == resolvedUserId)
            .Select(u => u.IsBanned)
            .FirstOrDefaultAsync();
        if (isBanned)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "This account has been suspended." });
            return;
        }

        context.Items["UserId"] = resolvedUserId;
        context.Items["PhoneNumber"] = phone;
        await _next(context);
    }

    // Fake-OTP login (no real SMS provider configured) can't verify a phone
    // number, so it re-authenticates via Supabase anonymous sign-in, which
    // mints a brand-new auth id every time. The phone number rides along in
    // the JWT's user_metadata claim instead (see useAuth.ts on the client).
    // If this auth id is new but a User already claimed that phone number
    // under a different (earlier) auth id, alias this request back to that
    // account instead of treating the returning user as brand new.
    private static async Task<Guid> ResolveUserIdAsync(HttpContext context, Guid authId, string? phone)
    {
        if (phone is null) return authId;
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        if (await db.Users.AnyAsync(u => u.Id == authId)) return authId;
        var existing = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.PhoneNumber == phone);
        return existing?.Id ?? authId;
    }

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
