using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminUsersControllerIntegrationTests : IntegrationTestBase
{
    private AdminUsersController BuildController() => new(Db, new AdminAuditService(Db), new ScoreService(Db, new ConfigService()));

    [Fact]
    public async Task ListUsers_FiltersBySearchTerm()
    {
        var matching = NewCompleteUser();
        matching.DisplayName = "Zolboo Searchable";
        var other = NewCompleteUser();
        other.DisplayName = "Someone Else";
        Db.Users.AddRange(matching, other);
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.ListUsers("searchable", 1, 20));
        var page = Assert.IsType<PagedResponse<AdminUserListItemDto>>(result.Value);

        var item = Assert.Single(page.Items);
        Assert.Equal(matching.Id, item.Id);
    }

    [Fact]
    public async Task ListUsers_Paginates()
    {
        for (int i = 0; i < 3; i++) Db.Users.Add(NewCompleteUser());
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.ListUsers(null, 1, 2));
        var page = Assert.IsType<PagedResponse<AdminUserListItemDto>>(result.Value);

        Assert.Equal(2, page.Items.Count);
        Assert.True(page.HasMore);
    }

    [Fact]
    public async Task GetUser_ReturnsDetailWithRecentScoreEvents()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DailyLogin", Delta = 5 });
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Equal(user.DisplayName, detail.DisplayName);
        var scoreEvent = Assert.Single(detail.RecentScoreEvents);
        Assert.Equal("DailyLogin", scoreEvent.EventType);
    }

    [Fact]
    public async Task GetUser_UnknownId_ReturnsNotFound()
    {
        var controller = BuildController();
        var result = await controller.GetUser(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetDeletionRequests_ComputesDaysRemainingAndExcludesAlreadyDeleted()
    {
        var pending = NewCompleteUser();
        pending.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2); // 5 days left of the 7-day grace period
        var alreadyDeleted = NewCompleteUser();
        alreadyDeleted.DeletionRequestedAt = DateTime.UtcNow.AddDays(-10);
        alreadyDeleted.IsDeleted = true;
        var notRequested = NewCompleteUser();
        Db.Users.AddRange(pending, alreadyDeleted, notRequested);
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetDeletionRequests());
        var list = Assert.IsAssignableFrom<IReadOnlyList<AdminDeletionRequestDto>>(result.Value);

        var entry = Assert.Single(list);
        Assert.Equal(pending.Id, entry.Id);
        Assert.Equal(5, entry.DaysRemaining);
    }
}
