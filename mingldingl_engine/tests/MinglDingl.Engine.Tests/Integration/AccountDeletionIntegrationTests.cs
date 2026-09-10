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
        var lootService = new HonourService(Db, NullLogger<HonourService>.Instance);
        var oathService = new OathService(Db, new ConfigService(), scoreService, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), lootService);
        var controller = new UsersController(Db, scoreService, new ReferralService(Db, lootService, NullLogger<ReferralService>.Instance), new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance), oathService, BuildUnconfiguredPhoneVerification(Db), BuildTestStorage(), new ConfigService())
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
    public async Task GetMe_WithPendingDeletion_LeavesItPendingAndReportsIt()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        var requestedAt = DateTime.UtcNow.AddDays(-2);
        user.DeletionRequestedAt = requestedAt;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var body = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await controller.GetMe()).Value);

        // This is the app's most-polled endpoint, and the delete flow only signs out once the user
        // acknowledges an alert — so cancelling here meant any refetch inside that window silently
        // revoked the request, with nothing on the wire to show it had happened.
        Assert.NotNull(body.DeletionRequestedAt);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.NotNull(reloaded!.DeletionRequestedAt);
    }

    [Fact]
    public async Task CancelDeletion_ClearsThePendingRequest()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var body = Assert.IsType<UserResponse>(
            Assert.IsType<OkObjectResult>(await BuildController(userId).CancelDeletion()).Value);
        Assert.Null(body.DeletionRequestedAt);

        Db.ChangeTracker.Clear();
        Assert.Null((await Db.Users.FindAsync(userId))!.DeletionRequestedAt);
    }

    [Fact]
    public async Task CancelDeletion_AfterTheSweepAnonymized_IsRefusedRatherThanReportingSuccess()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-30);
        user.IsDeleted = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        // There is no profile left to come back to, so success here would be a lie.
        Assert.IsType<BadRequestObjectResult>(await BuildController(userId).CancelDeletion());
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
