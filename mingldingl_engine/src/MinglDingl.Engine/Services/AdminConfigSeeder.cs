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
                db.AdminConfigs.Add(new AdminConfig
                {
                    Key = def.Key,
                    Category = def.Category,
                    ValueType = def.ValueType,
                    Value = def.DefaultValue,
                    Description = def.Description,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = "system",
                });
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
        await db.SaveChangesAsync();
    }
}
