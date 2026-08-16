using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

// These run against the real dev Postgres (already seeded with ~100 users
// via IntegrationTestBase), so every assertion here is a before/after delta
// from adding known rows — never an absolute count, which would depend on
// whatever happens to already be in the shared dev database.
public class AdminAnalyticsControllerIntegrationTests : IntegrationTestBase
{
    private AdminAnalyticsController BuildController() => new(Db);

    [Fact]
    public async Task GetOverview_CountsUsersByStatusAndMembership()
    {
        var before = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        var active = NewCompleteUser();
        active.MembershipLevel = "Silver";

        var paused = NewCompleteUser();
        paused.IsPaused = true;

        var deleted = NewCompleteUser();
        deleted.IsDeleted = true;

        Db.Users.AddRange(active, paused, deleted);
        await Db.SaveChangesAsync();

        var after = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        Assert.Equal(before.TotalUsers + 3, after.TotalUsers);
        Assert.Equal(before.ActiveUsers + 1, after.ActiveUsers);
        Assert.Equal(before.PausedUsers + 1, after.PausedUsers);
        Assert.Equal(before.DeletedUsers + 1, after.DeletedUsers);
        Assert.Equal(before.UsersByMembership.GetValueOrDefault("Silver") + 1, after.UsersByMembership.GetValueOrDefault("Silver"));
        Assert.Equal(30, after.SignupsLast30Days.Count);
    }

    [Fact]
    public async Task GetOverview_EstimatesRevenueFromMembershipMix()
    {
        var before = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        var silverUser = NewCompleteUser();
        silverUser.MembershipLevel = "Silver"; // 5900 MNT/month per MembershipController.AllTiers
        Db.Users.Add(silverUser);
        await Db.SaveChangesAsync();

        var after = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        Assert.Equal(before.EstimatedMonthlyRevenueMnt + 5900, after.EstimatedMonthlyRevenueMnt);
    }
}
