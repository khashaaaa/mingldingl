using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

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
        var journal = new SaveJournal(db);

        return db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            // SaveChanges accepts what it wrote the moment it succeeds, before the commit. If the
            // commit then fails, the rows are rolled back but the tracker already believes them
            // written, so the retry saw no changes and wrote nothing. Put back what the failed
            // attempt's saves accepted before running again.
            journal.RestoreUnsaved();

            foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == EntityState.Added).ToList())
                if (!alreadyPending.Contains(entry.Entity))
                    entry.State = EntityState.Detached;

            journal.Start();
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync(ct);
                var result = await work();
                await tx.CommitAsync(ct);
                journal.Clear();
                return result;
            }
            finally
            {
                journal.Stop();
            }
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

    /// <summary>
    /// What each SaveChanges inside one attempt wrote, so a rolled-back attempt can be undone in the
    /// tracker. <c>acceptAllChangesOnSuccess: false</c> is the textbook fix but only holds for a
    /// single save: the work here saves several times, and each later save would write the
    /// unaccepted inserts again.
    /// </summary>
    private sealed class SaveJournal
    {
        private readonly AppDbContext _db;
        private readonly Dictionary<object, (EntityState State, HashSet<string> Modified)> _written =
            new(ReferenceEqualityComparer.Instance);
        private List<(object Entity, EntityState State, HashSet<string> Modified)>? _saving;

        public SaveJournal(AppDbContext db) => _db = db;

        public void Start()
        {
            _db.SavingChanges += OnSaving;
            _db.SavedChanges += OnSaved;
            _db.SaveChangesFailed += OnFailed;
        }

        public void Stop()
        {
            _db.SavingChanges -= OnSaving;
            _db.SavedChanges -= OnSaved;
            _db.SaveChangesFailed -= OnFailed;
            _saving = null;
        }

        public void Clear() => _written.Clear();

        private void OnSaving(object? sender, SavingChangesEventArgs e)
        {
            _db.ChangeTracker.DetectChanges();
            _saving = _db.ChangeTracker.Entries()
                .Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                .Select(x => (x.Entity, x.State, x.State == EntityState.Modified
                    ? x.Properties.Where(p => p.IsModified).Select(p => p.Metadata.Name).ToHashSet()
                    : new HashSet<string>()))
                .ToList();
        }

        private void OnSaved(object? sender, SavedChangesEventArgs e)
        {
            if (_saving is null) return;
            foreach (var (entity, state, modified) in _saving)
            {
                if (!_written.TryGetValue(entity, out var prior))
                {
                    _written[entity] = (state, modified);
                    continue;
                }

                // An insert later updated is still just an insert; an insert later deleted never existed.
                if (prior.State == EntityState.Added)
                {
                    if (state == EntityState.Deleted) _written.Remove(entity);
                    continue;
                }
                if (state == EntityState.Modified && prior.State == EntityState.Modified)
                    prior.Modified.UnionWith(modified);
                else
                    _written[entity] = (state, modified);
            }
            _saving = null;
        }

        private void OnFailed(object? sender, SaveChangesFailedEventArgs e) => _saving = null;

        public void RestoreUnsaved()
        {
            foreach (var (entity, (state, modified)) in _written)
            {
                var entry = _db.Entry(entity);
                switch (state)
                {
                    case EntityState.Added:
                        entry.State = EntityState.Added;
                        break;
                    case EntityState.Deleted:
                        entry.State = EntityState.Deleted;
                        break;
                    case EntityState.Modified when entry.State != EntityState.Detached:
                        foreach (var name in modified) entry.Property(name).IsModified = true;
                        break;
                }
            }
            _written.Clear();
        }
    }
}
