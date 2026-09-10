using Microsoft.EntityFrameworkCore;

/// <summary>
/// Transaction helper for code that must be atomic but may run under a transaction it did not open.
/// Npgsql refuses a nested <c>BeginTransaction</c> outright, and every integration test runs inside
/// a per-test rollback transaction — so a service that unconditionally begins its own is untestable
/// except through a separately committed context.
/// <para>
/// Joining rather than nesting is also the correct semantics: the caller's transaction is the wider
/// unit of work, and <c>pg_advisory_xact_lock</c> taken inside it is held for exactly as long.
/// In production nothing wraps a request, so this begins and commits a transaction of its own.
/// </para>
/// </summary>
public static class AmbientTransaction
{
    public static Task<T> InTransactionAsync<T>(
        this AppDbContext db, Func<Task<T>> work, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null) return work();

        // The connection is configured with EnableRetryOnFailure, so the execution strategy re-runs
        // this delegate on a transient failure — and entities the failed attempt added are still
        // tracked as Added. Left alone, the retry's SaveChanges inserts them alongside the ones it
        // adds itself: two Ships for one weave, two Matches for one pair. Only what an attempt
        // added is dropped; clearing the tracker outright would take unsaved work belonging to
        // whoever else is sharing this scoped context.
        var alreadyPending = PendingInserts(db);

        return db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == EntityState.Added).ToList())
                if (!alreadyPending.Contains(entry.Entity))
                    entry.State = EntityState.Detached;

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var result = await work();
            await tx.CommitAsync(ct);
            return result;
        });
    }

    public static async Task InTransactionAsync(
        this AppDbContext db, Func<Task> work, CancellationToken ct = default) =>
        await db.InTransactionAsync<bool>(async () => { await work(); return true; }, ct);

    /// <summary>
    /// Inserts already queued before this block ran, by identity — two <c>EntityEntry</c> values for
    /// the same row are distinct objects, so the entities themselves are what gets compared.
    /// </summary>
    private static HashSet<object> PendingInserts(AppDbContext db) =>
        new(db.ChangeTracker.Entries().Where(e => e.State == EntityState.Added).Select(e => e.Entity),
            ReferenceEqualityComparer.Instance);
}
