using System.Collections.Concurrent;

/// <summary>
/// Brute-force protection for the single admin account. In-memory and per-instance, which is
/// sufficient for the current single-container deploy; a multi-instance deploy would need this
/// moved to shared state.
/// </summary>
public class LoginThrottleService
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan Lockout = TimeSpan.FromMinutes(15);

    private sealed class Entry
    {
        public int Failures;
        public DateTime FirstFailureAt;
        public DateTime? LockedUntil;
    }

    private static readonly TimeSpan PruneInterval = TimeSpan.FromMinutes(5);
    private const int MaxTrackedKeys = 10_000;

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);
    private long _nextPruneAtTicks = DateTime.UtcNow.Add(PruneInterval).Ticks;

    private static string Key(string? username, string? ip) => $"{username ?? ""}|{ip ?? ""}";

    /// <summary>Entries currently held. Exposed so a test can assert the dictionary stays bounded.</summary>
    internal int TrackedKeyCount => _entries.Count;

    /// <summary>Remaining lockout, or null when the caller may attempt a login.</summary>
    public TimeSpan? RetryAfter(string? username, string? ip)
    {
        if (!_entries.TryGetValue(Key(username, ip), out var entry)) return null;

        lock (entry)
        {
            if (entry.LockedUntil is not DateTime until) return null;
            var remaining = until - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                entry.LockedUntil = null;
                entry.Failures = 0;
                return null;
            }
            return remaining;
        }
    }

    public void RecordFailure(string? username, string? ip)
    {
        // The key includes the caller-supplied username, so without pruning an anonymous endpoint
        // lets anyone grow this dictionary without bound just by rotating the username field.
        Prune();

        var key = Key(username, ip);
        if (_entries.Count >= MaxTrackedKeys && !_entries.ContainsKey(key)) return;

        var entry = _entries.GetOrAdd(key, _ => new Entry { FirstFailureAt = DateTime.UtcNow });

        lock (entry)
        {
            var now = DateTime.UtcNow;
            if (now - entry.FirstFailureAt > Window)
            {
                entry.Failures = 0;
                entry.FirstFailureAt = now;
            }

            entry.Failures++;
            if (entry.Failures >= MaxAttempts) entry.LockedUntil = now + Lockout;
        }
    }

    public void RecordSuccess(string? username, string? ip) => _entries.TryRemove(Key(username, ip), out _);

    /// <summary>
    /// Drops entries that can no longer affect a decision: not locked out, and last touched
    /// longer ago than the failure window. Runs at most once per <see cref="PruneInterval"/>.
    /// </summary>
    private void Prune()
    {
        var now = DateTime.UtcNow;
        long nextPrune = Interlocked.Read(ref _nextPruneAtTicks);
        if (now.Ticks < nextPrune) return;
        if (Interlocked.CompareExchange(ref _nextPruneAtTicks, now.Add(PruneInterval).Ticks, nextPrune) != nextPrune)
            return;

        foreach (var (key, entry) in _entries)
        {
            bool expired;
            lock (entry)
            {
                expired = entry.LockedUntil is not DateTime until
                    ? now - entry.FirstFailureAt > Window
                    : until <= now;
            }
            if (expired) _entries.TryRemove(key, out _);
        }
    }
}
