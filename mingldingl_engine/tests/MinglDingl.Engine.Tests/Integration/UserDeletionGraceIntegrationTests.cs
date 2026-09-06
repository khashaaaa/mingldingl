using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class UserDeletionGraceIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId, ConfigService config)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, config);
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, loot);
        var ships = new ShipService(Db, loot, score, config, milestones, BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        return new UsersController(Db, score, new ReferralService(Db, loot, NullLogger<ReferralService>.Instance), ships, oaths,
            BuildUnconfiguredPhoneVerification(Db), BuildTestStorage(), config)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    [Fact]
    public async Task RequestDeletion_ReportsTheConfiguredGracePeriod()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var config = new ConfigService();
        config.Set("account.deletion_grace_days", "3");

        var result = Assert.IsType<OkObjectResult>(await BuildController(user.Id, config).RequestDeletion());

        Assert.Equal(3, Assert.IsType<UserResponse>(result.Value).DeletionGraceDays);
    }

    [Fact]
    public async Task RequestDeletion_DefaultGracePeriod_IsSevenDays()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController(user.Id, new ConfigService()).RequestDeletion());

        Assert.Equal(7, Assert.IsType<UserResponse>(result.Value).DeletionGraceDays);
    }
}
