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
            await context.Response.WriteAsJsonAsync(new { error = "Invalid authentication token." });
            return;
        }

        var phone = ExtractPhone(context.User);
        var resolvedUserId = await ResolveUserIdAsync(context, userId.Value, phone);

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
