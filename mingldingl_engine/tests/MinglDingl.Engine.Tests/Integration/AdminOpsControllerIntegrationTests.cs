using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminOpsControllerIntegrationTests : IntegrationTestBase
{
    private AdminOpsController BuildController()
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var provider = new ServiceCollection()
            .AddSingleton(Db)
            .AddSingleton(config)
            .AddSingleton(score)
            .AddSingleton(oaths)
            .AddSingleton(new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush()))
            .AddSingleton(BuildTestStorage())
            .BuildServiceProvider();
        var sweep = new DailyMaintenanceBackgroundService(
            new SingleProviderScopeFactory(provider),
            NullLogger<DailyMaintenanceBackgroundService>.Instance);
        return new AdminOpsController(sweep, new AdminAuditService(Db), new MembershipCatalog(new ConfigService()));
    }

    [Fact]
    public async Task RunMaintenanceSweep_CompletesSuccessfully()
    {
        var result = await BuildController().RunMaintenanceSweep(CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void GetPricing_ReturnsAllMembershipTiers()
    {
        var result = Assert.IsType<OkObjectResult>(BuildController().GetPricing());
        var tiers = Assert.IsAssignableFrom<IReadOnlyList<MembershipTierResponse>>(result.Value);

        Assert.Contains(tiers, t => t.Level == "Silver" && t.MonthlyPriceMnt == 10900);
    }
}
