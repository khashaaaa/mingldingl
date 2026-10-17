using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Bonds;

/// Every 5 minutes: warns the silent side (embers), lets silent bonds go cold, fades bonds no one
/// ever wrote in. Each bond is handled in its own transaction and skipped if another instance
/// holds it, so two engines never judge the same bond twice.
public sealed class BondSweep(IServiceScopeFactory scopes, IClock clock, IConfig config, ILogger<BondSweep> log) : BackgroundService
{
    public static readonly TimeSpan Every = TimeSpan.FromMinutes(5);

    public sealed record Result(int Embers, int Cold, int Faded);

    public async Task<Result> RunAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var embersBefore = now.AddHours(-config.Int(ConfigKeys.EmbersHours));
        var coldBefore = now.AddHours(-config.Int(ConfigKeys.ColdHours));
        var fadeBefore = now.AddDays(-config.Int(ConfigKeys.UnspokenDays));

        List<Guid> cold, embers, faded;
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            var live = db.Set<Bond>().AsNoTracking().Where(b => b.State == BondState.Live);
            cold = await live.Where(b => b.LastLetterAt < coldBefore).Select(b => b.Id).Take(500).ToListAsync(ct);
            embers = await live.Where(b => b.LastLetterAt < embersBefore && b.LastLetterAt >= coldBefore && b.EmbersAt == null)
                .Select(b => b.Id).Take(500).ToListAsync(ct);
            faded = await live.Where(b => b.LastLetterAt == null && b.CreatedAt < fadeBefore).Select(b => b.Id).Take(500).ToListAsync(ct);
        }

        int nCold = 0, nEmbers = 0, nFaded = 0;
        foreach (var id in cold) if (await OneAsync(id, Judge.Cold, coldBefore, ct)) nCold++;
        foreach (var id in embers) if (await OneAsync(id, Judge.Embers, embersBefore, ct)) nEmbers++;
        foreach (var id in faded) if (await OneAsync(id, Judge.Fade, fadeBefore, ct)) nFaded++;
        if (nCold + nEmbers + nFaded > 0)
            log.LogInformation("Bond sweep: {Embers} embers, {Cold} cold, {Faded} faded", nEmbers, nCold, nFaded);

        // Meetings (asked "Did they come?", settled, lapsed) and calls left running: each in its own scope.
        var meetings = 0;
        List<Guid> due, stale;
        await using (var scope = scopes.CreateAsyncScope())
        {
            due = await scope.ServiceProvider.GetRequiredService<Encounters.MeetingService>().DueAsync(ct);
            stale = await scope.ServiceProvider.GetRequiredService<Video.VideoService>().StaleAsync(ct);
        }
        foreach (var id in due)
        {
            await using var scope = scopes.CreateAsyncScope();
            meetings += await scope.ServiceProvider.GetRequiredService<Encounters.MeetingService>().SweepOneAsync(id, ct);
        }
        foreach (var id in stale)
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<Video.VideoService>().EndStaleAsync(id, ct);
        }
        if (meetings + stale.Count > 0) log.LogInformation("Encounter sweep: {Meetings} meetings, {Calls} calls", meetings, stale.Count);
        return new(nEmbers, nCold, nFaded);
    }

    private enum Judge { Embers, Cold, Fade }

    private async Task<bool> OneAsync(Guid id, Judge judge, DateTimeOffset before, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDb>();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await db.Set<Bond>()
            .FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {id} FOR UPDATE SKIP LOCKED").SingleOrDefaultAsync(ct);
        // Re-check under the lock: a reply may have landed since the list was read.
        if (b is null || b.State != BondState.Live) return false;
        // A sworn meeting holds the fire: no embers or cold while it stands or is being asked
        // about, and the silence counts again only from when it was settled.
        if (judge is Judge.Embers or Judge.Cold && await db.Set<Encounters.Meeting>().AnyAsync(m => m.BondId == b.Id
                && (m.State == Encounters.MeetingState.Sworn || m.State == Encounters.MeetingState.Checking || m.ClosedAt > before), ct))
            return false;
        var live = sp.GetRequiredService<ILiveOutbox>();
        var push = sp.GetRequiredService<IPushOutbox>();
        var bonds = sp.GetRequiredService<BondService>();
        // Only embers and cold send a push that names someone; a fade is silent.
        var names = judge == Judge.Fade
            ? []
            : await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == b.AId || p.AccountId == b.BId)
                .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);

        switch (judge)
        {
            case Judge.Embers when b.LastLetterAt < before && b.EmbersAt is null && b.LastLetterBy is { } writer:
                b.EmbersAt = clock.UtcNow;
                var silent = b.Other(writer);
                var hours = config.Int(ConfigKeys.ColdHours) - config.Int(ConfigKeys.EmbersHours);
                push.Send(silent, PushKinds.Embers, b.Id, names.GetValueOrDefault(writer), hours.ToString());
                live.ToAccount(b.AId, LiveKinds.BondUpdated, b.Id);
                live.ToAccount(b.BId, LiveKinds.BondUpdated, b.Id);
                break;
            case Judge.Cold when b.LastLetterAt < before && b.LastLetterBy is { } lastWriter:
                var quiet = b.Other(lastWriter);
                bonds.Close(b, BondState.Cold, quiet);
                await db.SaveChangesAsync(ct);
                var score = sp.GetRequiredService<ScoreService>();
                await score.AwardAsync(quiet, DeedKinds.GoneCold, -config.Int(ConfigKeys.ScoreGoneCold), b.Id, ct);
                await score.DockAsync(quiet, config.Int(ConfigKeys.ReputationGoneCold), ct);
                push.Send(quiet, PushKinds.GoneCold, b.Id, names.GetValueOrDefault(lastWriter));
                push.Send(lastWriter, PushKinds.GoneCold, b.Id, names.GetValueOrDefault(quiet));
                break;
            case Judge.Fade when b.LastLetterAt is null && b.CreatedAt < before:
                bonds.Close(b, BondState.Faded, null);
                break;
            default:
                return false;
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return true;
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(Every);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { await RunAsync(stop); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Bond sweep failed"); }
        }
    }
}
