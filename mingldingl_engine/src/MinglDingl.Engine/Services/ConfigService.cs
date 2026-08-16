using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;

// Single in-memory source of truth for admin-tunable values that used to be
// hardcoded C# constants (tier thresholds, pricing, quest definitions, ...).
// Registered as a Singleton so the cache is shared across requests instead
// of reloading from the DB every request — AdminConfigController writes
// directly into this cache after each DB update, so there's no polling or
// propagation delay on this single-instance deployment.
public class ConfigService
{
    private readonly ConcurrentDictionary<string, string> _cache = new();

    public void Set(string key, string value) => _cache[key] = value;

    public bool GetBool(string key, bool defaultValue) =>
        _cache.TryGetValue(key, out var raw) && bool.TryParse(raw, out var value) ? value : defaultValue;

    public double GetNumber(string key, double defaultValue) =>
        _cache.TryGetValue(key, out var raw) && double.TryParse(raw, out var value) ? value : defaultValue;

    public string GetString(string key, string defaultValue) =>
        _cache.TryGetValue(key, out var raw) ? raw : defaultValue;

    public async Task LoadCacheAsync(AppDbContext db, CancellationToken ct = default)
    {
        var entries = await db.AdminConfigs.AsNoTracking().ToListAsync(ct);
        foreach (var entry in entries)
            _cache[entry.Key] = entry.Value;
    }
}
