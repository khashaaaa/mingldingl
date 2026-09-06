using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace MinglDingl.Engine.Tests.Integration;

public class DevControllerIntegrationTests : IntegrationTestBase
{
    private DevController BuildController(bool isDevelopment)
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
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

        var env = new Mock<IHostEnvironment>();
        env.Setup(e => e.EnvironmentName).Returns(isDevelopment ? Environments.Development : Environments.Production);

        return new DevController(sweep, env.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    [Fact]
    public async Task RunMaintenanceSweep_InDevelopment_RunsTheSweep()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(-1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(isDevelopment: true);
        var result = await controller.RunMaintenanceSweep(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Equal("Free", reloaded!.MembershipLevel);
    }

    [Fact]
    public async Task RunMaintenanceSweep_OutsideDevelopment_ReturnsNotFoundAndDoesNothing()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(-1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(isDevelopment: false);
        var result = await controller.RunMaintenanceSweep(CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Equal("Gold", reloaded!.MembershipLevel);
    }
}
