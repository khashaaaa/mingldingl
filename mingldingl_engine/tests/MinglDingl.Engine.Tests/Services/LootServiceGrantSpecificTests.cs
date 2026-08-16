namespace MinglDingl.Engine.Tests.Services;

public class LootServiceGrantSpecificTests : Integration.IntegrationTestBase
{
    private LootService BuildService() => new(Db, new ScoreService(Db, new ConfigService()));

    [Fact]
    public async Task GrantSpecificAsync_KnownItem_GrantsItAndReturnsIt()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildService().GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.NotNull(result);
        Assert.Equal("title_threadweaver", result!.Id);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }

    [Fact]
    public async Task GrantSpecificAsync_UnknownItemId_ReturnsNullWithoutThrowing()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildService().GrantSpecificAsync(userId, "not_a_real_item", "ShipMilestone");

        Assert.Null(result);
    }

    [Fact]
    public async Task GrantSpecificAsync_AlreadyOwned_ReturnsNullWithoutDuplicating()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        var second = await service.GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.Null(second);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }
}
