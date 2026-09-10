using System.Collections.Concurrent;

/// <summary>
/// Per-user rate limit on <c>POST /photos/upload</c>. Decoding an image is the most expensive
/// thing an ordinary account can ask this engine to do, and every accepted upload lands on a
/// public disk that nothing else bounds — so the loop has to be closed here.
/// <para>
/// In-memory and per-instance, deliberately: the same trade-off
/// <see cref="LoginThrottleService"/> makes, and sufficient for the current single-container
/// deploy. A window is a fixed bucket rather than a true sliding one, which can admit up to
/// twice the quota across a boundary; that is well inside what this is defending against.
/// </para>
/// </summary>
public class PhotoUploadThrottleService
{
    private const int MaxUploadsPerWindow = 30;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(10);
    private const int MaxTrackedUsers = 50_000;

    private sealed class Bucket
    {
        public int Count;
        public DateTime WindowStartedAt;
    }

    private readonly ConcurrentDictionary<Guid, Bucket> _buckets = new();
    private long _nextPruneAtTicks = DateTime.UtcNow.Add(Window).Ticks;

    /// <summary>Buckets currently held. Exposed so a test can assert this stays bounded.</summary>
    internal int TrackedUserCount => _buckets.Count;

    /// <summary>Consumes one upload allowance, or false when this user has spent the window's.</summary>
    public bool TryTake(Guid userId)
    {
        Prune();

        var now = DateTime.UtcNow;
        // Keyed by an authenticated user id, so it cannot be grown by an anonymous caller — but a
        // long-lived instance still accumulates one entry per user who ever uploaded.
        if (_buckets.Count >= MaxTrackedUsers && !_buckets.ContainsKey(userId)) return true;

        var bucket = _buckets.GetOrAdd(userId, _ => new Bucket { WindowStartedAt = now });
        lock (bucket)
        {
            if (now - bucket.WindowStartedAt >= Window)
            {
                bucket.WindowStartedAt = now;
                bucket.Count = 0;
            }
            if (bucket.Count >= MaxUploadsPerWindow) return false;
            bucket.Count++;
            return true;
        }
    }

    private void Prune()
    {
        var now = DateTime.UtcNow;
        long nextPrune = Interlocked.Read(ref _nextPruneAtTicks);
        if (now.Ticks < nextPrune) return;
        if (Interlocked.CompareExchange(ref _nextPruneAtTicks, now.Add(Window).Ticks, nextPrune) != nextPrune)
            return;

        foreach (var (key, bucket) in _buckets)
        {
            bool expired;
            lock (bucket) expired = now - bucket.WindowStartedAt >= Window;
            if (expired) _buckets.TryRemove(key, out _);
        }
    }
}
