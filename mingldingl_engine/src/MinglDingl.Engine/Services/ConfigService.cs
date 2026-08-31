using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;

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
