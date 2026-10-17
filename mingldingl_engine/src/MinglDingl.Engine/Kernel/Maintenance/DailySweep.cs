using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Kernel.Maintenance;

/// Hourly housekeeping. Singleton (so /dev/run-sweep can run it now) and hosted.
public sealed class DailySweep(IServiceScopeFactory scopes, IClock clock, ILogger<DailySweep> log, Features.Stats.OpsClock ops) : BackgroundService
{
    public static readonly TimeSpan Every = TimeSpan.FromHours(1);

    public async Task RunAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var now = clock.UtcNow;

        // A rotated token's encrypted successor is only needed for its 30 s grace.
        var grace = await db.Set<RefreshToken>().Where(t => t.GracePayload != null && t.GraceUntil < now)
            .ExecuteUpdateAsync(u => u.SetProperty(t => t.GracePayload, (string?)null), ct);

        // Signed-out devices keep their record for 30 days (admin can see them), then go with their tokens.
        var devices = await db.Set<DeviceSession>().Where(d => d.RevokedAt != null && d.RevokedAt < now.AddDays(-30))
            .ExecuteDeleteAsync(ct);

        var expired = await db.Set<PhoneVerification>()
            .Where(v => (v.State == VerificationState.Pending || v.State == VerificationState.Superseded) && v.ExpiresAt < now)
            .ExecuteUpdateAsync(u => u.SetProperty(v => v.State, VerificationState.Expired), ct);

        // A verification holds a phone number and a code; nothing needs it after 30 days.
        var old = await db.Set<PhoneVerification>().Where(v => v.CreatedAt < now.AddDays(-30)).ExecuteDeleteAsync(ct);

        // Characters finished before points existed get their finished-character points once.
        var backfilled = await scope.ServiceProvider.GetRequiredService<Features.Score.ScoreService>().BackfillFinishedAsync(ct);

        // Abandoned characters whose day has come, each in its own scope and transaction.
        var burned = 0;
        foreach (var id in await scope.ServiceProvider.GetRequiredService<Features.Auth.AccountService>().DueAsync(ct))
        {
            await using var one = scopes.CreateAsyncScope();
            if (await one.ServiceProvider.GetRequiredService<Features.Auth.AccountService>().BurnAsync(id, ct)) burned++;
        }

        ops.DailySweepAt = clock.UtcNow;
        log.LogInformation("Sweep: {Grace} grace payloads, {Devices} devices, {Expired} expired, {Old} old verifications, {Backfilled} backfilled, {Burned} burned",
            grace, devices, expired, old, backfilled, burned);
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(Every);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { await RunAsync(stop); }
            catch (Exception e) when (!stop.IsCancellationRequested) { log.LogError(e, "Sweep failed"); }
        }
    }
}
