using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class UserAccountManagementIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new HonourService(Db, NullLogger<HonourService>.Instance);
        var oathService = new OathService(Db, new ConfigService(), scoreService, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), lootService);
        var controller = new UsersController(Db, scoreService, new ReferralService(Db, lootService, NullLogger<ReferralService>.Instance), new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance), oathService, BuildUnconfiguredPhoneVerification(Db), BuildTestStorage(), new ConfigService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task GetBlockedUsers_ThenUnblock_RemovesFromList()
    {
        var userId = Guid.NewGuid();
        var blockedId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(userId), NewCompleteUser(blockedId));
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = userId, BlockedId = blockedId });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var listResult = Assert.IsType<OkObjectResult>(await controller.GetBlockedUsers());
        var list = Assert.IsType<List<BlockedUserResponse>>(listResult.Value);
        Assert.Single(list);
        Assert.Equal(blockedId, list[0].UserId);

        var unblockResult = Assert.IsType<OkObjectResult>(await controller.Unblock(blockedId));
        var afterUnblock = Assert.IsType<List<BlockedUserResponse>>(unblockResult.Value);
        Assert.Empty(afterUnblock);
        Assert.False(await Db.BlockedUsers.AnyAsync(b => b.BlockerId == userId && b.BlockedId == blockedId));
    }

    [Fact]
    public async Task ChangePhone_ToNumberAlreadyTaken_Rejected()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.PhoneNumber = "88112233";
        Db.Users.AddRange(NewCompleteUser(userId), other);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.ChangePhone(new ChangePhoneRequest("88112233"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ChangePhone_ToFreeNumber_Succeeds()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        await controller.ChangePhone(new ChangePhoneRequest("99887766"));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Equal("99887766", reloaded!.PhoneNumber);
    }
}
