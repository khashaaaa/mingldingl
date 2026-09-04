using System.Collections.Concurrent;
using System.Globalization;
using Microsoft.EntityFrameworkCore;

public class ConfigService
{
    private readonly ConcurrentDictionary<string, string> _cache = new();

    public void Set(string key, string value) => _cache[key] = value;

    public bool GetBool(string key, bool defaultValue) =>
        _cache.TryGetValue(key, out var raw) && bool.TryParse(raw, out var value) ? value : defaultValue;

    public double GetNumber(string key, double defaultValue) =>
        _cache.TryGetValue(key, out var raw) && double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && double.IsFinite(value) ? value : defaultValue;

    /// <summary>
    /// The Flame Rite can only gate pledges while video calls exist: with <c>video.enabled</c>
    /// off, no token can be minted, so requiring the rite would deadlock every match.
    /// </summary>
    public bool FlameRiteRequired() =>
        GetBool("dating.flamerite.required", true) && GetBool("video.enabled", true);

    public string GetString(string key, string defaultValue) =>
        _cache.TryGetValue(key, out var raw) ? raw : defaultValue;

    public async Task LoadCacheAsync(AppDbContext db, CancellationToken ct = default)
    {
        var entries = await db.AdminConfigs.AsNoTracking().ToListAsync(ct);
        foreach (var entry in entries)
            _cache[entry.Key] = entry.Value;
    }
}
