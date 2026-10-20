using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Push;

public sealed record PushTokenRequest([Required, StringLength(FieldLimits.PushToken)] string Token);

public sealed class PushTokens(AppDb db, IClock clock)
{
    public async Task SetAsync(Guid accountId, Guid sessionId, string token, CancellationToken ct = default)
    {
        token = token.Trim();
        if (!token.StartsWith("ExponentPushToken[", StringComparison.Ordinal) && !token.StartsWith("ExpoPushToken[", StringComparison.Ordinal))
            throw new DomainException(400, "push.token", "That is not a push token");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // The token moves to this session: another account on the same phone stops receiving.
        await db.Set<PushToken>().Where(t => t.Token == token && t.DeviceSessionId != sessionId).ExecuteDeleteAsync(ct);
        var row = await db.Set<PushToken>().SingleOrDefaultAsync(t => t.DeviceSessionId == sessionId, ct);
        if (row is null) db.Add(row = new PushToken { DeviceSessionId = sessionId });
        row.AccountId = accountId;
        row.Token = token;
        row.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public Task ClearAsync(Guid sessionId, CancellationToken ct = default) =>
        db.Set<PushToken>().Where(t => t.DeviceSessionId == sessionId).ExecuteDeleteAsync(ct);
}

public sealed record PushMessage(string To, string Title, string Body, IReadOnlyDictionary<string, string> Data);

public interface IPushGateway
{
    Task SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default);
}

/// Expo's push service: up to 100 messages per request.
public sealed class ExpoPushGateway(HttpClient http, ILogger<ExpoPushGateway> log) : IPushGateway
{
    public async Task SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default)
    {
        foreach (var batch in messages.Chunk(100))
        {
            var body = batch.Select(m => new { to = m.To, title = m.Title, body = m.Body, data = m.Data, sound = "default", priority = "high" });
            using var r = await http.PostAsJsonAsync("push/send", body, ct);
            if (!r.IsSuccessStatusCode) log.LogWarning("Expo push answered {Status}", (int)r.StatusCode);
        }
    }
}

/// Reads the queue and sends each push to the person's live devices, in their language.
public sealed class PushSender(PushQueue queue, IServiceScopeFactory scopes, IPushGateway gateway, ILogger<PushSender> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        await foreach (var item in queue.Reader.ReadAllAsync(stop))
        {
            try { await SendAsync(item, stop); }
            catch (Exception e) when (e is not OperationCanceledException) // one failed push never stops the rest
            {
                log.LogWarning(e, "Push {Kind} failed", item.Kind);
            }
        }
    }

    public async Task SendAsync(PushItem item, CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var locale = await db.Set<Profile.Profile>().Where(p => p.AccountId == item.AccountId).Select(p => p.Locale)
            .SingleOrDefaultAsync(ct) ?? "en";
        var tokens = await (from t in db.Set<PushToken>()
                            join s in db.Set<DeviceSession>() on t.DeviceSessionId equals s.Id
                            where t.AccountId == item.AccountId && s.RevokedAt == null
                            select t.Token).ToListAsync(ct);
        if (tokens.Count == 0) return;
        var (title, body) = PushCopy.Render(item, locale);
        var data = new Dictionary<string, string> { ["kind"] = item.Kind };
        if (item.BondId is { } b) data["bondId"] = b.ToString();
        await gateway.SendAsync(tokens.Select(t => new PushMessage(t, title, body, data)).ToList(), ct);
    }
}

public sealed class PushEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me/push-token").WithTags("Push");
        g.MapPut("", async (PushTokenRequest req, ClaimsPrincipal u, PushTokens svc, CancellationToken ct) =>
        {
            await svc.SetAsync(u.AccountId(), u.SessionId(), req.Token, ct);
            return Results.NoContent();
        }).AsWrite().WithName("SetPushToken");
        g.MapDelete("", async (ClaimsPrincipal u, PushTokens svc, CancellationToken ct) =>
        {
            await svc.ClearAsync(u.SessionId(), ct);
            return Results.NoContent();
        }).RequireAuthorization().WithName("ClearPushToken");
    }
}
