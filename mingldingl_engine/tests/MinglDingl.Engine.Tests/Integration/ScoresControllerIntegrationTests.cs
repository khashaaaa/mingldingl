using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class ScoresControllerIntegrationTests : IntegrationTestBase
{
    private ScoresController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var controller = new ScoresController(Db, new ScoreService(Db, new ConfigService()), new HonourService(Db, NullLogger<HonourService>.Instance))
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task Leaderboard_UlaanbaatarDistrictUser_SharesTheCapitalCohort()
    {
        var capitalUser = NewCompleteUser();
        capitalUser.City = "Ulaanbaatar";
        capitalUser.TotalScore = 999_998;
        var districtUser = NewCompleteUser();
        districtUser.City = "Khan-Uul"; // a UB district — before the fix this was its own lonely board
        districtUser.TotalScore = 999_999;
        Db.Users.AddRange(capitalUser, districtUser);
        await Db.SaveChangesAsync();

        var result = await BuildController(districtUser.Id).GetLeaderboard();
        var board = Assert.IsType<LeaderboardResponse>(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal("Ulaanbaatar", board.City);
        // Both the district user and the capital user share one board; the district user tops it.
        Assert.Equal(999_999, board.Entries[0].Score);
        Assert.True(board.Entries[0].IsCurrentUser);
        Assert.Contains(board.Entries, e => e.Score == 999_998 && !e.IsCurrentUser);
    }

    [Fact]
    public async Task Leaderboard_ProvinceUser_DoesNotSeeTheCapitalCohort()
    {
        var capitalUser = NewCompleteUser();
        capitalUser.City = "Ulaanbaatar";
        capitalUser.TotalScore = 999_996;
        var provinceUser = NewCompleteUser();
        provinceUser.City = "Erdenet";
        provinceUser.TotalScore = 999_997;
        Db.Users.AddRange(capitalUser, provinceUser);
        await Db.SaveChangesAsync();

        var result = await BuildController(provinceUser.Id).GetLeaderboard();
        var board = Assert.IsType<LeaderboardResponse>(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal("Erdenet", board.City);
        Assert.DoesNotContain(board.Entries, e => e.Score == 999_996);
    }

    [Fact]
    public async Task DailyLogin_CalledTwiceSameDay_OnlyFirstCallAwardsXp()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var first = Assert.IsType<OkObjectResult>(await controller.DailyLogin());
        var firstBody = Assert.IsType<DailyLoginResponse>(first.Value);
        Assert.True(firstBody.Awarded > 0);
        Assert.Null(firstBody.Message);

        var second = Assert.IsType<OkObjectResult>(await controller.DailyLogin());
        var secondBody = Assert.IsType<DailyLoginResponse>(second.Value);
        Assert.Equal(0, secondBody.Awarded);
        Assert.Equal("Already logged in today", secondBody.Message);

        Db.ChangeTracker.Clear();
        var events = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "DailyLogin").ToList();
        Assert.Single(events);
    }

    [Fact]
    public async Task GetMyScoreDetail_ReturnsStreakAndTierProgress_WithoutMutatingState()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 150;
        user.GemTier = "Opal";
        user.CurrentStreak = 6;
        user.LongestStreak = 14;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail());
        var body = Assert.IsType<ScoreDetailResponse>(result.Value);

        Assert.Equal(150, body.TotalScore);
        Assert.Equal("Opal", body.GemTier);
        Assert.Equal(6, body.CurrentStreak);
        Assert.Equal(14, body.LongestStreak);
        Assert.Equal(1, body.TierIndex);
        Assert.Equal(1, body.TierBonus);
        Assert.Equal("Amethyst", body.NextTier);
        Assert.Equal(300, body.NextTierThreshold);
        Assert.Equal(25.0, body.ProgressPct);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        Assert.Equal(6, reloaded.CurrentStreak);
    }

    [Fact]
    public async Task GetMyScoreHistory_ReturnsNewestFirst_AndPaginatesWithCursor()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);

        var baseTime = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
        for (int i = 0; i < 5; i++)
        {
            Db.ScoreEvents.Add(new ScoreEvent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EventType = "DailyLogin",
                Delta = 5,
                CreatedAt = baseTime.AddDays(i),
            });
        }
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var firstPage = Assert.IsType<OkObjectResult>(await controller.GetMyScoreHistory(null, null, 3));
        var firstBody = Assert.IsType<ScoreHistoryResponse>(firstPage.Value);
        Assert.Equal(3, firstBody.Items.Count);
        Assert.Equal(baseTime.AddDays(4), firstBody.Items[0].CreatedAt);
        Assert.Equal(baseTime.AddDays(2), firstBody.Items[2].CreatedAt);
        Assert.Equal(baseTime.AddDays(2), firstBody.NextCursor);

        var secondPage = Assert.IsType<OkObjectResult>(await controller.GetMyScoreHistory(firstBody.NextCursor, firstBody.NextCursorId, 3));
        var secondBody = Assert.IsType<ScoreHistoryResponse>(secondPage.Value);
        Assert.Equal(2, secondBody.Items.Count);
        Assert.Equal(baseTime.AddDays(1), secondBody.Items[0].CreatedAt);
        Assert.Equal(baseTime, secondBody.Items[1].CreatedAt);
        Assert.Null(secondBody.NextCursor);
    }

    [Fact]
    public async Task GetMyScoreHistory_TiedTimestamps_UsesIdTiebreaker_NoSkipOrDuplicate()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);

        var tiedTime = new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc);
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() }.OrderByDescending(g => g).ToArray();

        foreach (var id in ids)
        {
            Db.ScoreEvents.Add(new ScoreEvent
            {
                Id = id,
                UserId = userId,
                EventType = "MatchReply",
                Delta = 5,
                CreatedAt = tiedTime,
            });
        }
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var firstPage = Assert.IsType<OkObjectResult>(await controller.GetMyScoreHistory(null, null, 2));
        var firstBody = Assert.IsType<ScoreHistoryResponse>(firstPage.Value);
        Assert.Equal(2, firstBody.Items.Count);
        Assert.NotNull(firstBody.NextCursor);
        Assert.NotNull(firstBody.NextCursorId);

        var secondPage = Assert.IsType<OkObjectResult>(await controller.GetMyScoreHistory(firstBody.NextCursor, firstBody.NextCursorId, 2));
        var secondBody = Assert.IsType<ScoreHistoryResponse>(secondPage.Value);

        Assert.Single(secondBody.Items);
        Assert.Null(secondBody.NextCursor);
    }

    [Fact]
    public async Task GetMyScoreDetail_PendingReferralReward_PersistsAcrossFetches_UntilAcked()
    {
        var inviterId = Guid.NewGuid();
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(inviterId));
        Db.Users.Add(NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();
        Db.Referrals.Add(new Referral
        {
            InviterUserId = inviterId,
            InviteeUserId = inviteeId,
            InviterRewardItemId = HonourService.Catalog[0].Id,
            InviteeRewardItemId = HonourService.Catalog[1].Id,
        });
        await Db.SaveChangesAsync();
        var controller = BuildController(inviterId);

        var first = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(first.PendingReferralReward);
        Assert.Equal(HonourService.Catalog[0].Id, first.PendingReferralReward!.Id);

        var second = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(second.PendingReferralReward);

        var ack = Assert.IsType<AckNotificationResponse>(Assert.IsType<OkObjectResult>(
            await controller.AckRewardNotification(new AckNotificationDto("referral"))).Value);
        Assert.True(ack.Acknowledged);

        var third = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.Null(third.PendingReferralReward);
    }

    [Fact]
    public async Task GetMyScoreDetail_NoPendingReferral_ReturnsNull()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var response = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);

        Assert.Null(response.PendingReferralReward);
    }

    [Fact]
    public async Task GetMyScoreDetail_PendingShipReward_PersistsAcrossFetches_UntilAcked()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Sparked",
            SlotAUserId = Guid.NewGuid(),
            SlotBUserId = Guid.NewGuid(),
            ShipperRewardItemId = HonourService.Catalog[0].Id,
        });
        await Db.SaveChangesAsync();
        var controller = BuildController(weaverId);

        var first = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(first.PendingShipReward);
        Assert.Equal(HonourService.Catalog[0].Id, first.PendingShipReward!.Id);

        var second = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(second.PendingShipReward);

        var ack = Assert.IsType<AckNotificationResponse>(Assert.IsType<OkObjectResult>(
            await controller.AckRewardNotification(new AckNotificationDto("ship"))).Value);
        Assert.True(ack.Acknowledged);

        var third = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.Null(third.PendingShipReward);
    }

    [Fact]
    public async Task AckRewardNotification_NothingPending_IsIdempotentNoOp()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var ack = Assert.IsType<AckNotificationResponse>(Assert.IsType<OkObjectResult>(
            await controller.AckRewardNotification(new AckNotificationDto("referral"))).Value);
        Assert.False(ack.Acknowledged);
    }

    [Fact]
    public async Task AckRewardNotification_UnknownKind_ReturnsBadRequest()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var result = await controller.AckRewardNotification(new AckNotificationDto("nonsense"));
        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetMyScoreDetail_LapsedStreak_IsDecayedForDisplay_WithoutWriting()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.CurrentStreak = 30;
        user.LongestStreak = 30;
        user.LastLoginDate = DateTime.UtcNow.Date.AddDays(-7);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var body = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);

        Assert.Equal(1, body.CurrentStreak);
        Assert.Equal(30, body.LongestStreak);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        Assert.Equal(30, reloaded.CurrentStreak);
    }

    [Fact]
    public async Task DailyLogin_SeventhConsecutiveDay_GrantsSevenDawns()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.CurrentStreak = 6;
        user.LastLoginDate = DateTime.UtcNow.Date.AddDays(-1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var body = Assert.IsType<DailyLoginResponse>(Assert.IsType<OkObjectResult>(await BuildController(userId).DailyLogin()).Value);

        Assert.True(body.StreakBonusAwarded);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_sevendawns"));
    }

    [Fact]
    public async Task DailyLogin_OrdinaryDay_GrantsNoHonour()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.CurrentStreak = 2;
        user.LastLoginDate = DateTime.UtcNow.Date.AddDays(-1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildController(userId).DailyLogin();

        Db.ChangeTracker.Clear();
        Assert.Empty(Db.UserItems.Where(i => i.UserId == userId));
    }
}
