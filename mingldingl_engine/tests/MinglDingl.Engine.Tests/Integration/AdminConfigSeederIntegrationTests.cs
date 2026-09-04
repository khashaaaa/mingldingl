using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminConfigSeederIntegrationTests : IntegrationTestBase
{
    private static readonly ConfigKeyDefinition RegistryDef = ConfigKeys.All[0];

    [Fact]
    public async Task SeedAsync_MissingKey_SeedsRegistryDefault()
    {
        await Db.AdminConfigs.Where(c => c.Key == RegistryDef.Key).ExecuteDeleteAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == RegistryDef.Key);
        Assert.Equal(RegistryDef.DefaultValue, row.Value);
        Assert.Equal(RegistryDef.ValueType, row.ValueType);
        Assert.Equal(RegistryDef.Category, row.Category);
        Assert.Equal(RegistryDef.Description, row.Description);
    }

    [Fact]
    public async Task SeedAsync_StoredValueOutsideRegistryBounds_ResetsToDefault()
    {
        var def = ConfigKeys.Find("ships.daily.cap")!;
        await Db.AdminConfigs.Where(c => c.Key == def.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig { Key = def.Key, Category = def.Category, ValueType = def.ValueType, Value = "-3", Description = def.Description, UpdatedBy = "admin" });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == def.Key);
        Assert.Equal(def.DefaultValue, row.Value);
        Assert.Equal("system", row.UpdatedBy);
    }

    [Fact]
    public async Task SeedAsync_TierLadderOutOfOrder_ResetsEveryTierThresholdToDefault()
    {
        var sapphire = ConfigKeys.Find("tier.sapphire.threshold")!;
        var ruby = ConfigKeys.Find("tier.ruby.threshold")!;
        await Db.AdminConfigs.Where(c => c.Key == sapphire.Key || c.Key == ruby.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig { Key = sapphire.Key, Category = sapphire.Category, ValueType = "Number", Value = "250", Description = sapphire.Description, UpdatedBy = "admin" });
        Db.AdminConfigs.Add(new AdminConfig { Key = ruby.Key, Category = ruby.Category, ValueType = "Number", Value = "1500", Description = ruby.Description, UpdatedBy = "admin" });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        Assert.Equal("600", (await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == sapphire.Key)).Value);
        Assert.Equal("1000", (await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == ruby.Key)).Value);
    }

    [Fact]
    public async Task SeedAsync_TierLadderInOrderButCustom_IsKept()
    {
        var ruby = ConfigKeys.Find("tier.ruby.threshold")!;
        await Db.AdminConfigs.Where(c => c.Key == ruby.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig { Key = ruby.Key, Category = ruby.Category, ValueType = "Number", Value = "1500", Description = ruby.Description, UpdatedBy = "admin" });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        Assert.Equal("1500", (await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == ruby.Key)).Value);
    }

    [Fact]
    public async Task SeedAsync_StaleMetadata_ReconciledButAdminValueKept()
    {
        await Db.AdminConfigs.Where(c => c.Key == RegistryDef.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig
        {
            Key = RegistryDef.Key,
            Category = "OldCategory",
            ValueType = RegistryDef.ValueType,
            Value = "1234",
            Description = "old description",
            UpdatedBy = "admin",
        });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == RegistryDef.Key);
        Assert.Equal(RegistryDef.Category, row.Category);
        Assert.Equal(RegistryDef.Description, row.Description);
        Assert.Equal("1234", row.Value);
    }

    [Fact]
    public async Task SeedAsync_ValueTypeChangedAndStoredValueNoLongerParses_ResetsToRegistryDefault()
    {
        await Db.AdminConfigs.Where(c => c.Key == RegistryDef.Key).ExecuteDeleteAsync();

        Db.AdminConfigs.Add(new AdminConfig
        {
            Key = RegistryDef.Key,
            Category = RegistryDef.Category,
            ValueType = "String",
            Value = "not-a-number",
            Description = RegistryDef.Description,
            UpdatedBy = "admin",
        });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == RegistryDef.Key);
        Assert.Equal(RegistryDef.ValueType, row.ValueType);
        Assert.Equal(RegistryDef.DefaultValue, row.Value);
        Assert.Equal("system", row.UpdatedBy);
    }

    [Fact]
    public async Task SeedAsync_ValueTypeChangedButStoredValueStillParses_ValueKept()
    {
        await Db.AdminConfigs.Where(c => c.Key == RegistryDef.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig
        {
            Key = RegistryDef.Key,
            Category = RegistryDef.Category,
            ValueType = "String",
            Value = "42",
            Description = RegistryDef.Description,
            UpdatedBy = "admin",
        });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == RegistryDef.Key);
        Assert.Equal(RegistryDef.ValueType, row.ValueType);
        Assert.Equal("42", row.Value);
    }
}
