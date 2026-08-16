using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AccountDeletionIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new LootService(Db, scoreService);
        var controller = new UsersController(Db, scoreService, new ReferralService(Db, lootService), new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db), new PushNotificationService(new HttpClient(), Db)))
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
        // Regression test for the grace-period cancel mechanism: loading your
        // own profile (what the app does on every session start) during the
        // 7-day window should silently clear DeletionRequestedAt, with no
        // separate "cancel" endpoint needed.
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2); // 2 days into the grace period
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
        // Once IsDeleted is true the 7-day window has already closed and the
        // sweep already ran — logging in afterward must not silently restore
        // DeletionRequestedAt to null as if nothing happened.
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
