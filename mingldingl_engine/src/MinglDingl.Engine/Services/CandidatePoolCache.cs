using System.Collections.Concurrent;

/// <summary>
/// The discover feed's ranked shortlist per viewer, kept briefly so later pages reuse it. Ranking
/// draws the whole pool, asks about seats and prior matches, and sorts it in memory — and every page
/// used to repeat all of that only to skip to its slice, so page five cost five times what page one
/// did. Page one always ranks afresh and replaces the entry; later pages read it while it is young.
/// <para>
/// Only ids are held; a page re-reads its slice through the live eligibility filter, so someone
/// blocked, matched or gone since the ranking simply drops out of that page.
/// </para>
/// </summary>
public class CandidatePoolCache
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
    private const int MaxTrackedViewers = 50_000;

    private readonly ConcurrentDictionary<Guid, (DateTime RankedAt, IReadOnlyList<Guid> Ranked)> _pools = new();
    private long _nextPruneAtTicks = DateTime.UtcNow.Add(Ttl).Ticks;

    public IReadOnlyList<Guid>? TryGet(Guid viewerId)
    {
        if (!_pools.TryGetValue(viewerId, out var entry)) return null;
        return DateTime.UtcNow - entry.RankedAt < Ttl ? entry.Ranked : null;
    }

    public void Set(Guid viewerId, IReadOnlyList<Guid> ranked)
    {
        var now = DateTime.UtcNow;
        Prune(now);
        if (_pools.Count >= MaxTrackedViewers && !_pools.ContainsKey(viewerId)) return;
        _pools[viewerId] = (now, ranked);
    }

    private void Prune(DateTime now)
    {
        long nextPrune = Interlocked.Read(ref _nextPruneAtTicks);
        if (now.Ticks < nextPrune) return;
        if (Interlocked.CompareExchange(ref _nextPruneAtTicks, now.Add(Ttl).Ticks, nextPrune) != nextPrune) return;
        foreach (var (key, entry) in _pools)
            if (now - entry.RankedAt >= Ttl) _pools.TryRemove(key, out _);
    }
}
