using System.Collections.Concurrent;

/// <summary>
/// Remembers which coalesced pushes went out recently, so a burst of the same kind to the same
/// person becomes one notification. Every chat message used to be its own push: twenty quick
/// lines were twenty buzzes, and the engine paid for each. The window runs from the push that was
/// sent, not the latest skipped one, so a long conversation still surfaces once per window.
/// <para>
/// In-memory and per-instance, the same trade-off <see cref="PhotoUploadThrottleService"/> makes.
/// Full means admit, not refuse: losing coalescing costs an extra buzz, losing the push costs the
/// message.
/// </para>
/// </summary>
public class PushCoalescer
{
    private const int MaxTrackedKeys = 100_000;
    private static readonly TimeSpan PruneInterval = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, DateTime> _sentAt = new(StringComparer.Ordinal);
    private long _nextPruneAtTicks = DateTime.UtcNow.Add(PruneInterval).Ticks;

    /// <summary>Keys currently held. Exposed so a test can assert this stays bounded.</summary>
    internal int TrackedKeyCount => _sentAt.Count;

    /// <summary>True when no push under <paramref name="key"/> went out within <paramref name="window"/>; records this one.</summary>
    public bool TryEnter(string key, TimeSpan window)
    {
        var now = DateTime.UtcNow;
        Prune(now, window);
        if (_sentAt.Count >= MaxTrackedKeys && !_sentAt.ContainsKey(key)) return true;

        bool entered = false;
        _sentAt.AddOrUpdate(
            key,
            _ => { entered = true; return now; },
            (_, last) =>
            {
                if (now - last < window) return last;
                entered = true;
                return now;
            });
        return entered;
    }

    private void Prune(DateTime now, TimeSpan window)
    {
        long nextPrune = Interlocked.Read(ref _nextPruneAtTicks);
        if (now.Ticks < nextPrune) return;
        if (Interlocked.CompareExchange(ref _nextPruneAtTicks, now.Add(PruneInterval).Ticks, nextPrune) != nextPrune)
            return;

        var horizon = window > PruneInterval ? window : PruneInterval;
        foreach (var (key, sentAt) in _sentAt)
            if (now - sentAt >= horizon) _sentAt.TryRemove(key, out _);
    }
}
