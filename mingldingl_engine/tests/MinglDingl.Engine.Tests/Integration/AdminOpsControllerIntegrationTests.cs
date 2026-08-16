using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminOpsControllerIntegrationTests : IntegrationTestBase
{
    // Same "hand the sweep this test's own already-open transaction" shape as
    // DailyMaintenanceBackgroundServiceTests.SingleProviderScopeFactory.
    private class SingleProviderScopeFactory : IServiceScopeFactory
    {
        private readonly IServiceProvider _provider;
        public SingleProviderScopeFactory(IServiceProvider provider) => _provider = provider;
        public IServiceScope CreateScope() => new NonDisposingScope(_provider);

        private class NonDisposingScope : IServiceScope
        {
            public NonDisposingScope(IServiceProvider provider) => ServiceProvider = provider;
            public IServiceProvider ServiceProvider { get; }
            public void Dispose() { }
        }
    }

    private AdminOpsController BuildController()
    {
        var provider = new ServiceCollection()
            .AddSingleton(Db)
            .AddSingleton(new ScoreService(Db, new ConfigService()))
            .BuildServiceProvider();
        var sweep = new DailyMaintenanceBackgroundService(
            new SingleProviderScopeFactory(provider),
            NullLogger<DailyMaintenanceBackgroundService>.Instance);
        return new AdminOpsController(sweep, new AdminAuditService(Db));
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

        Assert.Contains(tiers, t => t.Level == "Silver" && t.MonthlyPriceMnt == 5900);
    }
}
