using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class UsersControllerIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId, string? phone = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        httpContext.Items["PhoneNumber"] = phone;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new LootService(Db, scoreService);
        var referralService = new ReferralService(Db, lootService);
        var shipService = new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db), new PushNotificationService(new HttpClient(), Db));
        var controller = new UsersController(Db, scoreService, referralService, shipService)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task Upsert_BrandNewUser_InsertsAndAwardsProfileCompleteBonus()
    {
        // Regression test for the Add-vs-Update bug: a brand-new user (never
        // previously saved) must be inserted, not updated, or the paired
        // ScoreEvent insert fails on its foreign key.
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);

        var result = await controller.Upsert(new CreateUserRequest(
            "New User", 26, "Male", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserResponse>(ok.Value);
        Assert.Equal(100, response.TotalScore);
        Assert.Equal("Opal", response.GemTier);
        Assert.True(response.IsProfileComplete);

        Db.ChangeTracker.Clear();
        var scoreEvents = Db.ScoreEvents.Where(e => e.UserId == userId).ToList();
        Assert.Single(scoreEvents);
        Assert.Equal("ProfileComplete", scoreEvents[0].EventType);
    }

    [Fact]
    public async Task Upsert_ExistingIncompleteUser_BecomingComplete_AwardsBonusOnlyOnce()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(new User { Id = userId, DisplayName = "Partial", Age = 20 });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var req = new CreateUserRequest(
            "Now Complete", 26, "Male", "Ulaanbaatar", "Filled in",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]);

        await controller.Upsert(req);
        await controller.Upsert(req); // submitting again should not re-award

        Db.ChangeTracker.Clear();
        var scoreEvents = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "ProfileComplete").ToList();
        Assert.Single(scoreEvents);
    }

    [Fact]
    public async Task Upsert_NewUser_StampsPhoneNumberFromCurrentUserMiddleware()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId, phone: "88112233");

        await controller.Upsert(new CreateUserRequest(
            "Phoned User", 26, "Male", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]));

        Db.ChangeTracker.Clear();
        var saved = await Db.Users.FindAsync(userId);
        Assert.Equal("88112233", saved!.PhoneNumber);
    }

    [Fact]
    public async Task Upsert_ExistingUserWithPhoneAlready_NeverOverwritesIt()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(new User { Id = userId, PhoneNumber = "88112233", DisplayName = "Has phone", Age = 20 });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();

        // A different phone claim on this request (shouldn't happen in practice,
        // but the once-claimed PhoneNumber must never be silently reassigned).
        var controller = BuildController(userId, phone: "99009900");
        await controller.Upsert(new CreateUserRequest(
            "Updated", 21, "Male", "Ulaanbaatar", "Edit",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]));

        Db.ChangeTracker.Clear();
        var saved = await Db.Users.FindAsync(userId);
        Assert.Equal("88112233", saved!.PhoneNumber);
    }

    [Fact]
    public async Task GetMe_NoReferralCodeYet_GeneratesAndPersistsOne()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var result = await controller.GetMe();

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserResponse>(ok.Value);
        Assert.False(string.IsNullOrEmpty(response.ReferralCode));
        Assert.Equal(6, response.ReferralCode!.Length);
    }

    [Fact]
    public async Task GetMe_CalledTwice_ReturnsTheSameReferralCode()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var first = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await controller.GetMe()).Value);
        var second = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await controller.GetMe()).Value);

        Assert.Equal(first.ReferralCode, second.ReferralCode);
    }

    [Fact]
    public async Task Upsert_WithValidReferralCode_GrantsRewardToBothAndSurfacesInviteeReward()
    {
        var inviterId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(inviterId));
        await Db.SaveChangesAsync();
        var inviterController = BuildController(inviterId);
        var inviterCode = Assert.IsType<UserResponse>(
            Assert.IsType<OkObjectResult>(await inviterController.GetMe()).Value).ReferralCode;

        var inviteeId = Guid.NewGuid();
        var inviteeController = BuildController(inviteeId);
        var result = await inviteeController.Upsert(new CreateUserRequest(
            "New Ally", 24, "Female", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
            ReferralCode: inviterCode));

        var response = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.NotNull(response.ReferralRewardItem);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.Referrals.Where(r => r.InviterUserId == inviterId && r.InviteeUserId == inviteeId));
    }

    [Fact]
    public async Task Upsert_WithUnknownReferralCode_StillCompletesOnboarding()
    {
        var inviteeId = Guid.NewGuid();
        var controller = BuildController(inviteeId);

        var result = await controller.Upsert(new CreateUserRequest(
            "New Ally", 24, "Female", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
            ReferralCode: "ZZZZZZ"));

        var response = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.True(response.IsProfileComplete);
        Assert.Null(response.ReferralRewardItem);
    }

    [Fact]
    public async Task Upsert_WithShipInviteCode_ResolvesTheWaitingSlot()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        var scoreService = new ScoreService(Db, new ConfigService());
        var shipService = new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService(), new MilestoneService(Db), new PushNotificationService(new HttpClient(), Db));
        await shipService.CreateAsync(weaverId, "88130001", "88130002"); // both AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        var code = ship.SlotAInviteCode!;

        var newUserId = Guid.NewGuid();
        var controller = BuildController(newUserId, phone: "88130001");
        await controller.Upsert(new CreateUserRequest(
            "New Nominee", 24, "Female", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
            ReferralCode: code));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal(newUserId, reloaded!.SlotAUserId);
        Assert.Equal("PendingOptIn", reloaded.SlotAOptIn);
    }

    [Fact]
    public async Task Upsert_SubmittedTwiceWithReferralCode_OnlyGrantsOnce()
    {
        var inviterId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(inviterId));
        await Db.SaveChangesAsync();
        var inviterCode = Assert.IsType<UserResponse>(
            Assert.IsType<OkObjectResult>(await BuildController(inviterId).GetMe()).Value).ReferralCode;

        var inviteeId = Guid.NewGuid();
        var controller = BuildController(inviteeId);
        var req = new CreateUserRequest(
            "New Ally", 24, "Female", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
            ReferralCode: inviterCode);

        await controller.Upsert(req);
        await controller.Upsert(req); // e.g. a retried request after a flaky response

        Db.ChangeTracker.Clear();
        Assert.Single(Db.Referrals.Where(r => r.InviteeUserId == inviteeId));
    }
}
