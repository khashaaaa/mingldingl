using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Honours;

/// Who a write may have earned an honour for. Scoped: one per request or sweep. Filled from the
/// change tracker as the write saves; checked once it commits (see HonourWatch).
public sealed class HonourTouches
{
    internal readonly HashSet<Guid> Accounts = [];
    internal readonly HashSet<Guid> Bonds = [];
    internal readonly List<(DateOnly Starts, DateOnly Ends)> Festivals = [];

    /// The dev seeders write history and check it quietly themselves; the check's own scope too.
    public bool Off { get; set; }

    internal bool Any => Accounts.Count > 0 || Bonds.Count > 0 || Festivals.Count > 0;

    internal void Clear()
    {
        Accounts.Clear();
        Bonds.Clear();
        Festivals.Clear();
    }
}

/// Honours are earned where the deeds happen, not when someone looks. Every save is read for what
/// an honour is made of (the deeds HonourService counts, bonds — made, sealed, retired, ten letters —
/// meetings closed or sworn, chambers cleared, Wanderings kept, an oath proven, a festival's dates);
/// after the commit, each person touched is checked in a scope of its own, and a new honour sends
/// honour.earned. A rolled-back write checks nothing. Reading GET /me/honours only reads.
public sealed class HonourWatch(HonourTouches touches, IServiceScopeFactory scopes, ILogger<HonourWatch> log)
    : SaveChangesInterceptor, IDbTransactionInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData e, InterceptionResult<int> result)
    {
        Collect(e.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> result,
        CancellationToken ct = default)
    {
        Collect(e.Context);
        return ValueTask.FromResult(result);
    }

    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e, int result, CancellationToken ct = default)
    {
        if (e.Context?.Database.CurrentTransaction is null) await RunAsync();
        return result;
    }

    public override int SavedChanges(SaveChangesCompletedEventData e, int result)
    {
        if (e.Context?.Database.CurrentTransaction is null) RunAsync().GetAwaiter().GetResult();
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData e) { if (e.Context?.Database.CurrentTransaction is null) touches.Clear(); }
    public override Task SaveChangesFailedAsync(DbContextErrorEventData e, CancellationToken ct = default) { SaveChangesFailed(e); return Task.CompletedTask; }

    public Task TransactionCommittedAsync(DbTransaction t, TransactionEndEventData e, CancellationToken ct = default) => RunAsync();
    public void TransactionCommitted(DbTransaction t, TransactionEndEventData e) => RunAsync().GetAwaiter().GetResult();
    public Task TransactionRolledBackAsync(DbTransaction t, TransactionEndEventData e, CancellationToken ct = default) { touches.Clear(); return Task.CompletedTask; }
    public void TransactionRolledBack(DbTransaction t, TransactionEndEventData e) => touches.Clear();
    public Task TransactionFailedAsync(DbTransaction t, TransactionErrorEventData e, CancellationToken ct = default) { touches.Clear(); return Task.CompletedTask; }
    public void TransactionFailed(DbTransaction t, TransactionErrorEventData e) => touches.Clear();

    private void Collect(DbContext? db)
    {
        if (db is null || touches.Off) return;
        foreach (var e in db.ChangeTracker.Entries())
        {
            if (e.State is not (EntityState.Added or EntityState.Modified)) continue;
            var added = e.State == EntityState.Added;
            switch (e.Entity)
            {
                case ScoreEvent s when added && HonourService.Deeds.Contains(s.Kind):
                    touches.Accounts.Add(s.AccountId);
                    break;
                case Bond b when added:
                    touches.Accounts.Add(b.AId);
                    touches.Accounts.Add(b.BId);
                    break;
                case Bond b when Changed(e, nameof(Bond.Seals), nameof(Bond.State), nameof(Bond.Origin))
                                 || Crossed(e, nameof(Bond.LettersA)) || Crossed(e, nameof(Bond.LettersB)):
                    touches.Bonds.Add(b.Id);
                    break;
                case Meeting m when added || Changed(e, nameof(Meeting.State), nameof(Meeting.Outcome), nameof(Meeting.SwornAt)):
                    touches.Bonds.Add(m.BondId);
                    break;
                case Campaign.ChamberCleared c when added:
                    touches.Bonds.Add(c.BondId);
                    break;
                case Wanderings.WanderingTaken t when t.KeptAt is not null && (added || Changed(e, nameof(Wanderings.WanderingTaken.KeptAt))):
                    touches.Bonds.Add(t.BondId);
                    break;
                case Profile.Profile p when p.OathProvenAt is not null && (added || Changed(e, nameof(Profile.Profile.OathProvenAt))):
                    touches.Accounts.Add(p.AccountId);
                    break;
                case Festivals.Festival f:
                    touches.Festivals.Add((f.Starts, f.Ends));
                    break;
            }
        }
    }

    private static bool Changed(EntityEntry e, params string[] props) => props.Any(p => e.Property(p).IsModified);

    /// Ten Words: a side's letters reaching the mark (not every letter after it).
    private static bool Crossed(EntityEntry e, string prop)
    {
        var p = e.Property(prop);
        return p.IsModified && p.OriginalValue is int before && p.CurrentValue is int after
            && before < HonourService.TenWords && after >= HonourService.TenWords;
    }

    private async Task RunAsync()
    {
        if (touches.Off || !touches.Any)
        {
            touches.Clear();
            return;
        }
        var accounts = touches.Accounts.ToHashSet();
        var bonds = touches.Bonds.ToList();
        var festivals = touches.Festivals.ToList();
        touches.Clear();
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<HonourTouches>().Off = true; // the check's own writes earn nothing
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            if (bonds.Count > 0)
                foreach (var b in await db.Set<Bond>().AsNoTracking().Where(b => bonds.Contains(b.Id))
                             .Select(b => new { b.AId, b.BId }).ToListAsync())
                {
                    accounts.Add(b.AId);
                    accounts.Add(b.BId);
                }
            foreach (var (starts, ends) in festivals)
            {
                // A festival's dates set or moved: whoever kept an encounter inside them may now hold its honour.
                var first = UbDays.Start(starts);
                var after = UbDays.Start(ends.AddDays(1));
                var pairs = await (from m in db.Set<Meeting>().AsNoTracking()
                                   join b in db.Set<Bond>() on m.BondId equals b.Id
                                   where m.Outcome == MeetingOutcome.Kept && m.At >= first && m.At < after
                                   select new { b.AId, b.BId }).ToListAsync();
                foreach (var p in pairs)
                {
                    accounts.Add(p.AId);
                    accounts.Add(p.BId);
                }
            }
            var honours = scope.ServiceProvider.GetRequiredService<HonourService>();
            foreach (var id in accounts) await honours.CheckAsync(id, quietly: false);
        }
        catch (Exception ex) // a missed check is caught by the next one; it must never fail the write
        {
            log.LogWarning(ex, "Honour check failed for {Count} account(s)", accounts.Count);
        }
    }
}
