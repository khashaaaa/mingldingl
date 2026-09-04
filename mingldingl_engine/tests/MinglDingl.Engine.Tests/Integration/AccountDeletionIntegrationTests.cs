using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class AccountDeletionIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new LootService(Db, scoreService, NullLogger<LootService>.Instance);
        var oathService = new OathService(Db, new ConfigService(), scoreService, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), lootService);
        var controller = new UsersController(Db, scoreService, new ReferralService(Db, lootService, NullLogger<ReferralService>.Instance), new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new PushNotificationService(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance), BuildTestBroadcast(), NullLogger<ShipService>.Instance), oathService, BuildUnconfiguredPhoneVerification(Db), BuildTestStorage(), new ConfigService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task RequestDeletion_SetsDeletionRequestedAt()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        await controller.RequestDeletion();

        Db.ChangeTracker.Clear();
        var user = await Db.Users.FindAsync(userId);
        Assert.NotNull(user!.DeletionRequestedAt);
        Assert.False(user.IsDeleted);
    }

    [Fact]
    public async Task GetMe_WithPendingDeletion_AutoCancels()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        await controller.GetMe();

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Null(reloaded!.DeletionRequestedAt);
    }

    [Fact]
    public async Task GetMe_AlreadyAnonymized_DoesNotResurrect()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-10);
        user.IsDeleted = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        await controller.GetMe();

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.NotNull(reloaded!.DeletionRequestedAt);
        Assert.True(reloaded.IsDeleted);
    }
}
