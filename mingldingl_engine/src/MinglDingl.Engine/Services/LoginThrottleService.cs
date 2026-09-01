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

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);

    private static string Key(string? username, string? ip) => $"{username ?? ""}|{ip ?? ""}";

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
        var entry = _entries.GetOrAdd(Key(username, ip), _ => new Entry { FirstFailureAt = DateTime.UtcNow });

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
}
