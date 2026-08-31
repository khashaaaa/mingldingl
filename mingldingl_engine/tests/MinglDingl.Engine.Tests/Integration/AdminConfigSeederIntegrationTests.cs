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
    public async Task SeedAsync_StaleMetadata_ReconciledButAdminValueKept()
    {
        await Db.AdminConfigs.Where(c => c.Key == RegistryDef.Key).ExecuteDeleteAsync();
        Db.AdminConfigs.Add(new AdminConfig
        {
            Key = RegistryDef.Key,
            Category = "OldCategory",
            ValueType = RegistryDef.ValueType,
            Value = "12345",
            Description = "old description",
            UpdatedBy = "admin",
        });
        await Db.SaveChangesAsync();

        await AdminConfigSeeder.SeedAsync(Db, NullLogger<AdminConfigSeederIntegrationTests>.Instance);

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == RegistryDef.Key);
        Assert.Equal(RegistryDef.Category, row.Category);
        Assert.Equal(RegistryDef.Description, row.Description);
        Assert.Equal("12345", row.Value);
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
