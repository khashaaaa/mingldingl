using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminAnalyticsControllerIntegrationTests : IntegrationTestBase
{
    private AdminAnalyticsController BuildController() => new(Db, new MembershipCatalog(new ConfigService()));

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
        silverUser.MembershipLevel = "Silver";
        Db.Users.Add(silverUser);
        await Db.SaveChangesAsync();

        var after = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        Assert.Equal(before.EstimatedMonthlyRevenueMnt + 10900, after.EstimatedMonthlyRevenueMnt);
    }

    [Fact]
    public async Task GetOverview_CountsOathNoShowFlameRiteShipAndTownSquareTotals()
    {
        var before = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        var sworn = NewCompleteUser();
        sworn.Oath = "Sworn";
        sworn.OathSwornAt = DateTime.UtcNow;
        var proven = NewCompleteUser();
        proven.Oath = "Proven";
        proven.OathSwornAt = DateTime.UtcNow;
        proven.OathProven = true;
        var flagged = NewCompleteUser();
        flagged.NoShowFlagCount = 1;
        Db.Users.AddRange(sworn, proven, flagged);
        Db.Matches.Add(new Match { InitiatorId = sworn.Id, ReceiverId = proven.Id, Status = "Active", FlameRiteCompletedAt = DateTime.UtcNow });
        Db.Matches.Add(new Match { InitiatorId = sworn.Id, ReceiverId = flagged.Id, Status = "Active" });
        Db.Ships.Add(new Ship { ShipperUserId = flagged.Id, Status = "Sparked" });
        Db.Ships.Add(new Ship { ShipperUserId = flagged.Id, Status = "Pending" });
        Db.TownSquareSessions.Add(new TownSquareSession
        {
            RsvpOpensAt = DateTime.UtcNow.AddDays(-1), RsvpClosesAt = DateTime.UtcNow.AddHours(-1),
            ScheduledStartAt = DateTime.UtcNow, Status = "Completed",
        });
        await Db.SaveChangesAsync();

        var after = Assert.IsType<AdminAnalyticsOverviewResponse>(
            Assert.IsType<OkObjectResult>(await BuildController().GetOverview()).Value);

        Assert.Equal(before.OathSwornUsers + 2, after.OathSwornUsers);
        Assert.Equal(before.OathProvenUsers + 1, after.OathProvenUsers);
        Assert.Equal(before.NoShowFlaggedUsers + 1, after.NoShowFlaggedUsers);
        Assert.Equal(before.FlameRitesCompleted + 1, after.FlameRitesCompleted);
        Assert.Equal(before.ShipsSparked + 1, after.ShipsSparked);
        Assert.Equal(before.TownSquareSessions + 1, after.TownSquareSessions);
    }
}
