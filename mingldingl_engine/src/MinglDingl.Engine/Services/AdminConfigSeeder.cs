using Microsoft.EntityFrameworkCore;

public static class AdminConfigSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        var existing = await db.AdminConfigs.ToDictionaryAsync(c => c.Key);
        foreach (var def in ConfigKeys.All)
        {
            if (!existing.TryGetValue(def.Key, out var row))
            {
                var added = new AdminConfig
                {
                    Key = def.Key,
                    Category = def.Category,
                    ValueType = def.ValueType,
                    Value = def.DefaultValue,
                    Description = def.Description,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = "system",
                };
                db.AdminConfigs.Add(added);
                existing[def.Key] = added;
                continue;
            }

            row.Category = def.Category;
            row.Description = def.Description;
            if (row.ValueType != def.ValueType)
            {
                row.ValueType = def.ValueType;
                if (ConfigValueValidator.Validate(def.ValueType, row.Value) is not null)
                {
                    logger.LogWarning(
                        "Config key {Key}: stored value '{Value}' does not parse as new ValueType {ValueType}; resetting to default '{Default}'",
                        def.Key, row.Value, def.ValueType, def.DefaultValue);
                    row.Value = def.DefaultValue;
                    row.UpdatedAt = DateTime.UtcNow;
                    row.UpdatedBy = "system";
                }
            }
        }
        ResetOutOfBoundsValues(existing, logger);
        ResetBrokenTierLadder(existing, logger);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Bounds are code, so a value stored before a bound existed (or tightened) may now be
    /// illegal. Such a value is reset to the default rather than left to break a read site.
    /// </summary>
    private static void ResetOutOfBoundsValues(Dictionary<string, AdminConfig> rows, ILogger logger)
    {
        foreach (var def in ConfigKeys.All)
        {
            if (!rows.TryGetValue(def.Key, out var row)) continue;
            var error = ConfigValueValidator.Validate(def, row.Value);
            if (error is null) continue;
            logger.LogWarning("Config key {Key}: stored value rejected ({Error}); resetting to default '{Default}'", def.Key, error, def.DefaultValue);
            ResetToDefault(row, def);
        }
    }

    /// <summary>
    /// Tier thresholds are only validated against each other on write, so a ladder saved before
    /// that rule existed can be out of order. CalculateTier would then skip tiers, and the next
    /// threshold edit would backfill the mistake onto every user, so the whole ladder goes back
    /// to the design defaults.
    /// </summary>
    private static void ResetBrokenTierLadder(Dictionary<string, AdminConfig> rows, ILogger logger)
    {
        var ladder = ScoreService.DefaultTierTable;
        var effective = new List<(string Key, int Value)>();
        foreach (var (tier, defaultMin) in ladder.Skip(1))
        {
            string key = ScoreService.TierThresholdKey(tier);
            int value = rows.TryGetValue(key, out var row) && int.TryParse(row.Value, out var parsed) ? parsed : defaultMin;
            effective.Add((key, value));
        }

        int previous = ladder[0].DefaultMinScore;
        bool ordered = true;
        foreach (var (_, value) in effective)
        {
            if (value <= previous) { ordered = false; break; }
            previous = value;
        }
        if (ordered) return;

        logger.LogWarning("Gem tier thresholds are out of order ({Ladder}); resetting every tier threshold to its default",
            string.Join(", ", effective.Select(e => $"{e.Key}={e.Value}")));
        foreach (var (tier, _) in ladder.Skip(1))
        {
            string key = ScoreService.TierThresholdKey(tier);
            var def = ConfigKeys.Find(key);
            if (def is not null && rows.TryGetValue(key, out var row)) ResetToDefault(row, def);
        }
    }

    private static void ResetToDefault(AdminConfig row, ConfigKeyDefinition def)
    {
        row.Value = def.DefaultValue;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = "system";
    }
}
