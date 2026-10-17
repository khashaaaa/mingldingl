using System.Collections.Concurrent;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Kernel.Config;

public sealed record ConfigView(string Key, string Value, string Default, string Category, string Description, string Type, int? Min, int? Max);

/// Reads: an in-memory cache of the config table, warmed at boot and written through on change.
public interface IConfig
{
    int Int(string key);
    bool Bool(string key);
    string Str(string key);
    IReadOnlyList<ConfigView> All();
}

public sealed class ConfigService : IConfig
{
    private readonly ConcurrentDictionary<string, string> _values = new();

    public int Int(string key) => int.Parse(Str(key), CultureInfo.InvariantCulture);
    public bool Bool(string key) => bool.Parse(Str(key));
    public string Str(string key) =>
        _values.TryGetValue(key, out var v) ? v : ConfigKeys.Find(key)?.Default ?? throw new KeyNotFoundException(key);

    public IReadOnlyList<ConfigView> All() => ConfigKeys.All
        .Select(d => new ConfigView(d.Key, Str(d.Key), d.Default, d.Category, d.Description, d.Type.ToString(), d.Min, d.Max))
        .ToList();

    internal void Put(string key, string value) => _values[key] = value;

    /// Inserts missing keys, re-syncs each key's metadata, never overwrites a stored value; warms the cache.
    public static async Task SeedAndLoadAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var now = scope.ServiceProvider.GetRequiredService<IClock>().UtcNow;
        var stored = await db.Set<ConfigEntry>().ToDictionaryAsync(e => e.Key);
        foreach (var d in ConfigKeys.All)
        {
            if (!stored.TryGetValue(d.Key, out var row))
            {
                row = new ConfigEntry { Key = d.Key, Value = d.Default, UpdatedAt = now };
                db.Add(row);
            }
            row.Category = d.Category;
            row.Description = d.Description;
            row.Type = d.Type;
        }
        await db.SaveChangesAsync();
        var cache = (ConfigService)services.GetRequiredService<IConfig>();
        // Every row is already tracked (loaded or just added), so the cache needs no second read.
        foreach (var entry in db.ChangeTracker.Entries<ConfigEntry>()) cache.Put(entry.Entity.Key, entry.Entity.Value);
    }
}

/// Writes: validates type, bounds and cross-key rules, stores, updates the cache, tells every client.
public sealed class ConfigWrites(AppDb db, IConfig config, IClock clock, ILiveOutbox live)
{
    public async Task<ConfigView> SetAsync(string key, string value)
    {
        var def = ConfigKeys.Find(key) ?? throw new DomainException(404, "config.unknown", $"No setting called {key}");
        value = value.Trim();
        switch (def.Type)
        {
            case ConfigType.Int:
                if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                    throw new DomainException(400, "config.bad_value", $"{key} must be a whole number");
                if (n < def.Min || n > def.Max)
                    throw new DomainException(400, "config.out_of_bounds", $"{key} must be between {def.Min} and {def.Max}");
                CheckCrossKey(key, n);
                value = n.ToString(CultureInfo.InvariantCulture);
                break;
            case ConfigType.Bool:
                if (!bool.TryParse(value, out var b))
                    throw new DomainException(400, "config.bad_value", $"{key} must be true or false");
                value = b ? "true" : "false";
                break;
            case ConfigType.Text:
                if (value.Length is 0 or > 200)
                    throw new DomainException(400, "config.bad_value", $"{key} must be 1–200 characters");
                break;
        }

        var row = await db.Set<ConfigEntry>().SingleAsync(e => e.Key == key);
        row.Value = value;
        row.UpdatedAt = clock.UtcNow;
        live.ToAll(LiveKinds.ConfigUpdated);
        live.ToAdmins(LiveKinds.ConfigUpdated);
        await db.SaveChangesAsync();
        ((ConfigService)config).Put(key, value);
        return config.All().Single(v => v.Key == key);
    }

    private void CheckCrossKey(string key, int n)
    {
        if (key == ConfigKeys.PhotosMin && n > config.Int(ConfigKeys.PhotosMax))
            throw new DomainException(400, "config.out_of_bounds", "photos.min cannot exceed photos.max");
        if (key == ConfigKeys.PhotosMax && n < config.Int(ConfigKeys.PhotosMin))
            throw new DomainException(400, "config.out_of_bounds", "photos.max cannot be below photos.min");
        CheckLadder(key, n, ConfigKeys.TierLadder);
        CheckLadder(key, n, ConfigKeys.SealLadder);
        CheckLadder(key, n, [ConfigKeys.EmbersHours, ConfigKeys.ColdHours]);
    }

    /// Each rung strictly above the one before it.
    private void CheckLadder(string key, int n, IReadOnlyList<string> ladder)
    {
        var i = ladder.ToList().IndexOf(key);
        if (i < 0) return;
        if (i > 0 && n <= config.Int(ladder[i - 1]))
            throw new DomainException(400, "config.out_of_bounds", $"{key} must be above {ladder[i - 1]}");
        if (i < ladder.Count - 1 && n >= config.Int(ladder[i + 1]))
            throw new DomainException(400, "config.out_of_bounds", $"{key} must be below {ladder[i + 1]}");
    }
}
