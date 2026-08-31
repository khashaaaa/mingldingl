using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminConfigControllerIntegrationTests : IntegrationTestBase
{
    private async Task<(AdminConfigController Controller, ConfigService Config)> BuildControllerAsync()
    {
        foreach (var def in ConfigKeys.All)
        {
            if (!await Db.AdminConfigs.AnyAsync(c => c.Key == def.Key))
            {
                Db.AdminConfigs.Add(new AdminConfig
                {
                    Key = def.Key,
                    Category = def.Category,
                    ValueType = def.ValueType,
                    Value = def.DefaultValue,
                    Description = def.Description,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = "system",
                });
            }
        }
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        await config.LoadCacheAsync(Db);
        return (new AdminConfigController(Db, config, new AdminAuditService(Db), new ScoreService(Db, config)), config);
    }

    [Fact]
    public void AllConfigKeys_HaveAValueTypeAndDefaultValueTheAdminValidatorAccepts()
    {
        foreach (var def in ConfigKeys.All)
        {
            var error = ConfigValueValidator.Validate(def.ValueType, def.DefaultValue);
            Assert.True(error is null, $"{def.Key}: {error}");
        }
    }

    [Fact]
    public async Task List_ReturnsSeededSapphireThreshold()
    {
        var (controller, _) = await BuildControllerAsync();
        var result = Assert.IsType<OkObjectResult>(await controller.List());
        var entries = Assert.IsAssignableFrom<List<AdminConfigDto>>(result.Value);
        Assert.Contains(entries, e => e.Key == "tier.sapphire.threshold" && e.Value == "600");
    }

    [Fact]
    public async Task Update_ValidNumber_PersistsAndInvalidatesCache()
    {
        var (controller, config) = await BuildControllerAsync();

        var result = await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("700"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AdminConfigDto>(ok.Value);
        Assert.Equal("700", dto.Value);
        Assert.Equal(700, config.GetNumber("tier.sapphire.threshold", 0));
    }

    [Fact]
    public async Task Update_InvalidNumber_ReturnsBadRequestAndDoesNotChangeCache()
    {
        var (controller, config) = await BuildControllerAsync();

        var result = await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("not-a-number"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(600, config.GetNumber("tier.sapphire.threshold", 0));
    }

    [Fact]
    public async Task Update_UnknownKey_ReturnsNotFound()
    {
        var (controller, _) = await BuildControllerAsync();
        var result = await controller.Update("no.such.key", new UpdateConfigRequest("1"));
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Update_LogsAuditEntryWithOldAndNewValue()
    {
        var (controller, _) = await BuildControllerAsync();
        await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("700"));

        var log = await Db.AdminAuditLogs
            .Where(l => l.EntityType == "AdminConfig" && l.EntityId == "tier.sapphire.threshold")
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(log);
        Assert.Equal("UpdateConfig", log!.Action);
        Assert.Contains("\"OldValue\":\"600\"", log.Details);
        Assert.Contains("\"NewValue\":\"700\"", log.Details);
    }

    [Fact]
    public async Task Revert_AfterUpdate_RestoresPreviousValueAndCache()
    {
        var (controller, config) = await BuildControllerAsync();
        await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("700"));

        var result = await controller.Revert("tier.sapphire.threshold");

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AdminConfigDto>(ok.Value);
        Assert.Equal("600", dto.Value);
        Assert.Equal(600, config.GetNumber("tier.sapphire.threshold", 0));
    }

    [Fact]
    public async Task Revert_NoPriorChange_ReturnsConflict()
    {
        var (controller, _) = await BuildControllerAsync();

        await Db.AdminAuditLogs
            .Where(l => l.EntityType == "AdminConfig" && l.EntityId == "tier.sapphire.threshold")
            .ExecuteDeleteAsync();

        var result = await controller.Revert("tier.sapphire.threshold");
        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Revert_CalledTwice_StaysAtOriginalValue()
    {
        var (controller, config) = await BuildControllerAsync();
        await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("700"));

        var firstRevert = await controller.Revert("tier.sapphire.threshold");
        var firstOk = Assert.IsType<OkObjectResult>(firstRevert);
        var firstDto = Assert.IsType<AdminConfigDto>(firstOk.Value);
        Assert.Equal("600", firstDto.Value);
        Assert.Equal(600, config.GetNumber("tier.sapphire.threshold", 0));

        var secondRevert = await controller.Revert("tier.sapphire.threshold");
        var secondOk = Assert.IsType<OkObjectResult>(secondRevert);
        var secondDto = Assert.IsType<AdminConfigDto>(secondOk.Value);
        Assert.Equal("600", secondDto.Value);
        Assert.Equal(600, config.GetNumber("tier.sapphire.threshold", 0));
    }

    [Fact]
    public async Task Update_TierThreshold_BackfillsStoredGemTiers()
    {
        var (controller, _) = await BuildControllerAsync();

        var user = NewCompleteUser();
        user.TotalScore = 450;
        user.GemTier = "Amethyst";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("400"));
        Assert.IsType<OkObjectResult>(result);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal("Sapphire", reloaded.GemTier);
    }

    [Fact]
    public async Task Revert_TierThreshold_BackfillsStoredGemTiersBack()
    {
        var (controller, _) = await BuildControllerAsync();

        var user = NewCompleteUser();
        user.TotalScore = 450;
        user.GemTier = "Amethyst";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("400"));
        var revert = await controller.Revert("tier.sapphire.threshold");
        Assert.IsType<OkObjectResult>(revert);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal("Amethyst", reloaded.GemTier);
    }

    [Fact]
    public async Task Update_ConfigChangeAndAuditRow_CommitTogether()
    {
        var (controller, _) = await BuildControllerAsync();
        await controller.Update("tier.sapphire.threshold", new UpdateConfigRequest("700"));

        Db.ChangeTracker.Clear();
        var row = await Db.AdminConfigs.AsNoTracking().SingleAsync(c => c.Key == "tier.sapphire.threshold");
        Assert.Equal("700", row.Value);
        Assert.True(await Db.AdminAuditLogs.AsNoTracking().AnyAsync(l =>
            l.EntityType == "AdminConfig" && l.EntityId == "tier.sapphire.threshold" && l.Action == "UpdateConfig"));
    }
}
