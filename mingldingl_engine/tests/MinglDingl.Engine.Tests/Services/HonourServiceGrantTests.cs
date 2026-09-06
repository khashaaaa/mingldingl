using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Services;

public class HonourServiceGrantTests : Integration.IntegrationTestBase
{
    private HonourService BuildService() => new(Db, NullLogger<HonourService>.Instance);

    [Fact]
    public async Task GrantAsync_KnownHonour_GrantsItAndReturnsIt()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildService().GrantAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.NotNull(result);
        Assert.Equal("title_threadweaver", result!.Id);
        Assert.Equal(HonourService.MetalGold, result.Rarity);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }

    [Fact]
    public async Task GrantAsync_UnknownId_ReturnsNullWithoutThrowing()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        Assert.Null(await BuildService().GrantAsync(userId, "not_a_real_item", "ShipMilestone"));
    }

    [Fact]
    public async Task GrantAsync_TierFrame_IsNotGrantable()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        // Frames come with the tier, so a stored row for one would be a second source of truth.
        Assert.Null(await BuildService().GrantAsync(userId, "frame_garnet", "anything"));
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.UserItems.Where(i => i.UserId == userId));
    }

    [Fact]
    public async Task GrantAsync_AlreadyHeld_ReturnsNullWithoutDuplicating()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.GrantAsync(userId, "title_threadweaver", "ShipMilestone");

        var second = await service.GrantAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.Null(second);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }
}
