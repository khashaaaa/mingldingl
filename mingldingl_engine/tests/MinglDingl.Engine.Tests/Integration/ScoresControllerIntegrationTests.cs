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
        var controller = new ScoresController(Db, new ScoreService(Db, new ConfigService()))
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task DailyLogin_CalledTwiceSameDay_OnlyFirstCallAwardsXp()
    {
        // Coverage for the DailyLogin award site after wrapping AwardWithDeltaAsync
        // in try/catch for ix_score_events_once_per_day (final review B.2): the
        // existing check-then-award idempotency path must still return the
        // "already logged in" response, not a 500, once the catch is in place.
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
        Assert.Equal(6, reloaded.CurrentStreak); // confirms this is a pure read, no mutation
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
                CreatedAt = baseTime.AddDays(i), // day 0 (oldest) .. day 4 (newest)
            });
        }
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var firstPage = Assert.IsType<OkObjectResult>(await controller.GetMyScoreHistory(null, null, 3));
        var firstBody = Assert.IsType<ScoreHistoryResponse>(firstPage.Value);
        Assert.Equal(3, firstBody.Items.Count);
        Assert.Equal(baseTime.AddDays(4), firstBody.Items[0].CreatedAt); // newest first
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
        // Three events sharing one exact timestamp - only Id breaks the tie.
        // EventType "MatchReply" deliberately avoids DailyLogin/QuestChest: those
        // two are the only types ix_score_events_once_per_day restricts to one
        // per user per UTC day (see that migration), which three same-day rows
        // of the same type would otherwise violate.
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

        // Exactly the third (remaining) event — not zero (skipped) and not a repeat of page 1.
        Assert.Single(secondBody.Items);
        Assert.Null(secondBody.NextCursor);
    }

    [Fact]
    public async Task GetMyScoreDetail_PendingReferralReward_SurfacesOnceThenClears()
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
            InviterRewardItemId = LootService.Catalog[0].Id,
            InviteeRewardItemId = LootService.Catalog[1].Id,
        });
        await Db.SaveChangesAsync();
        var controller = BuildController(inviterId);

        var first = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(first.PendingReferralReward);
        Assert.Equal(LootService.Catalog[0].Id, first.PendingReferralReward!.Id);

        var second = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.Null(second.PendingReferralReward);
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
    public async Task GetMyScoreDetail_PendingShipReward_SurfacesOnceThenClears()
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
            ShipperRewardItemId = LootService.Catalog[0].Id,
        });
        await Db.SaveChangesAsync();
        var controller = BuildController(weaverId);

        var first = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(first.PendingShipReward);
        Assert.Equal(LootService.Catalog[0].Id, first.PendingShipReward!.Id);

        var second = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.Null(second.PendingShipReward);
    }
}
