using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminUsersModerationIntegrationTests : IntegrationTestBase
{
    private AdminUsersController BuildController() =>
        new(Db, new AdminAuditService(Db), new ScoreService(Db, new ConfigService()));

    private static System.Security.Claims.ClaimsPrincipal AdminPrincipal() =>
        new(new System.Security.Claims.ClaimsIdentity(
            [new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "test-admin")], "AdminBearer"));

    private AdminUsersController BuildControllerWithUser()
    {
        var controller = BuildController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext { User = AdminPrincipal() },
        };
        return controller;
    }

    [Fact]
    public async Task BanUser_SetsIsBannedAndReason_AndLogsAudit()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildControllerWithUser();
        var result = Assert.IsType<OkObjectResult>(await controller.BanUser(user.Id, new AdminBanUserRequest("Spam")));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.True(detail.IsBanned);
        Assert.Equal("Spam", detail.BanReason);
        Assert.NotNull(detail.BannedAt);

        var logged = Db.AdminAuditLogs.Single(l => l.Action == "BanUser" && l.EntityId == user.Id.ToString());
        Assert.Equal("test-admin", logged.AdminUsername);
    }

    [Fact]
    public async Task UnbanUser_ClearsBanFields()
    {
        var user = NewCompleteUser();
        user.IsBanned = true;
        user.BannedAt = DateTime.UtcNow;
        user.BanReason = "test";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildControllerWithUser();
        var result = Assert.IsType<OkObjectResult>(await controller.UnbanUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.False(detail.IsBanned);
        Assert.Null(detail.BanReason);
    }

    [Fact]
    public async Task CancelDeletion_ClearsDeletionRequestedAt()
    {
        var user = NewCompleteUser();
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildControllerWithUser();
        var result = Assert.IsType<OkObjectResult>(await controller.CancelDeletion(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Null(detail.DeletionRequestedAt);
    }

    [Fact]
    public async Task AdjustScore_UpdatesTotalScoreAndCreatesScoreEvent()
    {
        var user = NewCompleteUser();
        user.TotalScore = 100;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildControllerWithUser();
        var result = Assert.IsType<OkObjectResult>(
            await controller.AdjustScore(user.Id, new AdminAdjustScoreRequest(50, "Compensation")));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Equal(150, detail.TotalScore);
        Assert.Contains(detail.RecentScoreEvents, e => e.EventType == "AdminAdjustment" && e.Delta == 50);

        var logged = Db.AdminAuditLogs.Single(l => l.Action == "AdjustScore" && l.EntityId == user.Id.ToString());
        Assert.Contains("Compensation", logged.Details);
    }

    [Fact]
    public async Task GetUser_ReturnsBlockRelationsInBothDirections()
    {
        var user = NewCompleteUser();
        var blockedByUser = NewCompleteUser();
        blockedByUser.DisplayName = "Blocked By Them";
        var blockerOfUser = NewCompleteUser();
        blockerOfUser.DisplayName = "Blocked Them";
        Db.Users.AddRange(user, blockedByUser, blockerOfUser);
        Db.BlockedUsers.Add(new BlockedUser { Id = Guid.NewGuid(), BlockerId = user.Id, BlockedId = blockedByUser.Id });
        Db.BlockedUsers.Add(new BlockedUser { Id = Guid.NewGuid(), BlockerId = blockerOfUser.Id, BlockedId = user.Id });
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Contains(detail.UsersBlockedByThem, b => b.DisplayName == "Blocked By Them");
        Assert.Contains(detail.UsersWhoBlockedThem, b => b.DisplayName == "Blocked Them");
    }

    [Fact]
    public async Task ListUsers_IncludesIsBannedFlag()
    {
        var user = NewCompleteUser();
        user.IsBanned = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.ListUsers(user.DisplayName, 1, 20));
        var page = Assert.IsType<PagedResponse<AdminUserListItemDto>>(result.Value);

        Assert.True(page.Items.Single().IsBanned);
    }

    [Fact]
    public async Task ResetNoShow_ZeroesFlagCount_AndLogsAudit()
    {
        var user = NewCompleteUser();
        user.NoShowFlagCount = 4;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildControllerWithUser();
        var result = Assert.IsType<OkObjectResult>(await controller.ResetNoShow(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Equal(0, detail.NoShowFlagCount);
        Db.ChangeTracker.Clear();
        Assert.Equal(0, (await Db.Users.FindAsync(user.Id))!.NoShowFlagCount);

        var logged = Db.AdminAuditLogs.Single(l => l.Action == "ResetNoShow" && l.EntityId == user.Id.ToString());
        Assert.Equal("test-admin", logged.AdminUsername);
        Assert.Equal("was 4", logged.Details);
    }

    [Fact]
    public async Task ResetNoShow_UnknownId_ReturnsNotFound()
    {
        var controller = BuildControllerWithUser();
        Assert.IsType<NotFoundObjectResult>(await controller.ResetNoShow(Guid.NewGuid()));
    }
}
