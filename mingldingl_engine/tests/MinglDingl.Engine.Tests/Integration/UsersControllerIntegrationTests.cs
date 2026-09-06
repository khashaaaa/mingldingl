using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class UsersControllerIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId, string? phone = null, LocalFileStorageService? storage = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        httpContext.Items["PhoneNumber"] = phone;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new HonourService(Db, NullLogger<HonourService>.Instance);
        var referralService = new ReferralService(Db, lootService, NullLogger<ReferralService>.Instance);
        var shipService = new ShipService(Db, lootService, scoreService, new ConfigService(), new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        var oathService = new OathService(Db, new ConfigService(), scoreService, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), lootService);
        var controller = new UsersController(Db, scoreService, referralService, shipService, oathService, BuildUnconfiguredPhoneVerification(Db), storage ?? BuildTestStorage(), new ConfigService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task Upsert_BrandNewUser_InsertsAndAwardsProfileCompleteBonus()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);

        var result = await controller.Upsert(new CreateUserRequest(
            "New User", 26, "Male", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserResponse>(ok.Value);
        Assert.True(response.IsProfileComplete);

        Db.ChangeTracker.Clear();

        var saved = await Db.Users.FindAsync(userId);
        Assert.Equal(100, saved!.TotalScore);
        Assert.Equal("Opal", saved.GemTier);

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
        await controller.Upsert(req);

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
    public async Task GetMe_UnswornUser_OathProgressIsNull()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var response = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await BuildController(userId).GetMe()).Value);

        Assert.Null(response.OathEncountersHeld);
        Assert.Null(response.OathEncountersNeeded);
    }

    [Fact]
    public async Task GetMe_SwornUser_OathProgressIsPopulated()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.Oath = "Kinship";
        user.OathSwornAt = DateTime.UtcNow.AddDays(-3);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var response = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await BuildController(userId).GetMe()).Value);

        Assert.Equal(0, response.OathEncountersHeld);
        Assert.Equal(2, response.OathEncountersNeeded);
    }

    [Fact]
    public async Task Upsert_WithValidReferralCode_RecordsReferralAndHonoursTheInviter()
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

        Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(result).Value);

        Db.ChangeTracker.Clear();
        var referral = Assert.Single(Db.Referrals.Where(r => r.InviterUserId == inviterId && r.InviteeUserId == inviteeId));
        Assert.Equal("title_allycaller", referral.InviterRewardItemId);
        Assert.Single(Db.UserItems.Where(i => i.UserId == inviterId && i.ItemId == "title_allycaller"));
        Assert.Empty(Db.UserItems.Where(i => i.UserId == inviteeId));
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
    }

    [Fact]
    public async Task Upsert_WithShipInviteCode_ResolvesTheWaitingSlot()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        var scoreService = new ScoreService(Db, new ConfigService());
        var shipService = new ShipService(Db, new HonourService(Db, NullLogger<HonourService>.Instance), scoreService, new ConfigService(), new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        await shipService.CreateAsync(weaverId, "88130001", "88130002");
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
        await controller.Upsert(req);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.Referrals.Where(r => r.InviteeUserId == inviteeId));
    }

    [Fact]
    public async Task Upsert_TogglingCompletenessRepeatedly_PaysProfileCompleteOnlyOnce()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        var photos = new List<string>
            { "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg" };
        var complete = new CreateUserRequest("Farmer", 26, "Male", "Ulaanbaatar", "Filled in", photos);
        var incomplete = new CreateUserRequest("Farmer", 26, "Male", "Ulaanbaatar", "", photos);

        for (int i = 0; i < 5; i++)
        {
            await controller.Upsert(complete);
            await controller.Upsert(incomplete);
        }

        Db.ChangeTracker.Clear();
        var events = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "ProfileComplete").ToList();
        Assert.Single(events);
        Assert.Equal(100, Db.Users.Single(u => u.Id == userId).TotalScore);
    }

    [Fact]
    public async Task Update_PreferredLocale_PersistsForPushLocalisation()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        await controller.Upsert(new CreateUserRequest("Bat", 26, "Male", "Ulaanbaatar", "Bio", []));

        await controller.Update(new UpdateUserRequest(
            null, null, null, null, null, null, null, null, null, null, null, null, null, PreferredLocale: "mn"));

        Db.ChangeTracker.Clear();
        Assert.Equal("mn", Db.Users.Single(u => u.Id == userId).PreferredLocale);
    }

    [Fact]
    public async Task Update_UnsupportedLocale_IsRejectedWithACode()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        await controller.Upsert(new CreateUserRequest("Bat", 26, "Male", "Ulaanbaatar", "Bio", []));

        var result = Assert.IsType<BadRequestObjectResult>(await controller.Update(new UpdateUserRequest(
            null, null, null, null, null, null, null, null, null, null, null, null, null, PreferredLocale: "fr")));

        Assert.Equal("profile.locale_invalid", Assert.IsType<ErrorResponse>(result.Value).Code);
        Db.ChangeTracker.Clear();
        Assert.Equal("en", Db.Users.Single(u => u.Id == userId).PreferredLocale);
    }

    [Fact]
    public async Task Upsert_PreferredLocale_IsStoredFromTheFirstRequest()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);

        await controller.Upsert(new CreateUserRequest("Bat", 26, "Male", "Ulaanbaatar", "Bio", [], PreferredLocale: "mn"));

        Db.ChangeTracker.Clear();
        Assert.Equal("mn", Db.Users.Single(u => u.Id == userId).PreferredLocale);
    }

    [Fact]
    public async Task Update_ClearingRequiredFields_MarksProfileIncomplete()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        await controller.Upsert(new CreateUserRequest(
            "Complete", 26, "Male", "Ulaanbaatar", "Filled in",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]));

        await controller.Update(new UpdateUserRequest(
            null, "", [], null, null, null, null, null, null, null, null, null, null));

        Db.ChangeTracker.Clear();
        Assert.False(Db.Users.Single(u => u.Id == userId).IsProfileComplete);
    }

    [Fact]
    public async Task Update_CompletingProfileThroughPut_PaysProfileCompleteOnce()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        await controller.Upsert(new CreateUserRequest("Partial", 26, "Male", "Ulaanbaatar", "", []));

        var photos = new List<string>
            { "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg" };
        await controller.Update(new UpdateUserRequest(
            null, "Filled in", photos, null, null, null, null, null, null, null, null, null, null));
        await controller.Update(new UpdateUserRequest(
            null, "Filled in again", photos, null, null, null, null, null, null, null, null, null, null));

        Db.ChangeTracker.Clear();
        Assert.True(Db.Users.Single(u => u.Id == userId).IsProfileComplete);
        Assert.Single(Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "ProfileComplete"));
    }

    [Fact]
    public async Task Update_RejectedByValidation_KeepsPhotoFilesOnDisk()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        var photos = new List<string>
            { "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg" };
        await controller.Upsert(new CreateUserRequest("Complete", 26, "Male", "Ulaanbaatar", "Filled in", photos));

        var deleted = new List<string>();
        var recordingController = BuildController(userId, storage: BuildRecordingStorage(deleted));

        // AgeMin > AgeMax is rejected, so the dropped photos must survive: the row still points at them.
        var result = await recordingController.Update(new UpdateUserRequest(
            null, null, ["https://example.com/1.jpg"], null, null, null, null, null, null,
            AgeMin: 40, AgeMax: 20, null, null));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(deleted);
        Db.ChangeTracker.Clear();
        Assert.Equal(3, Db.Users.Single(u => u.Id == userId).PhotoUrls.Count);
    }

    [Fact]
    public async Task Update_AcceptedByValidation_DeletesDroppedPhotoFiles()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        var photos = new List<string>
            { "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg" };
        await controller.Upsert(new CreateUserRequest("Complete", 26, "Male", "Ulaanbaatar", "Filled in", photos));

        var deleted = new List<string>();
        var recordingController = BuildController(userId, storage: BuildRecordingStorage(deleted));

        await recordingController.Update(new UpdateUserRequest(
            null, null, ["https://example.com/1.jpg"], null, null, null, null, null, null, null, null, null, null));

        Assert.Equal(["https://example.com/2.jpg", "https://example.com/3.jpg"], deleted);
    }

    [Fact]
    public async Task GetMyItems_ListsHeldHonoursAndTheFramesOfEveryTierReached()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 350;
        user.GemTier = "Amethyst";
        user.EquippedFrameId = "frame_opal";
        Db.Users.Add(user);
        Db.UserItems.Add(new UserItem { UserId = userId, ItemId = "title_oathkeeper", Source = "oath_proven" });
        Db.UserItems.Add(new UserItem { UserId = userId, ItemId = "title_wanderer", Source = "legacy" });
        await Db.SaveChangesAsync();

        var items = Assert.IsType<List<OwnedItemResponse>>(Assert.IsType<OkObjectResult>(await BuildController(userId).GetMyItems()).Value);

        Assert.Equal(["title_oathkeeper", "frame_garnet", "frame_opal", "frame_amethyst"], items.Select(i => i.ItemId));
        Assert.True(items.Single(i => i.ItemId == "frame_opal").Equipped);
        Assert.False(items.Single(i => i.ItemId == "frame_garnet").Equipped);
        Assert.All(items.Where(i => i.ItemType == "Frame"), f => Assert.Equal(HonourService.MetalGold, f.Rarity));
    }

    [Fact]
    public async Task EquipItem_FrameAtOrBelowTier_Equips_FrameAboveTier_IsNotOwned()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 350;
        user.GemTier = "Amethyst";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var equipped = Assert.IsType<UserResponse>(Assert.IsType<OkObjectResult>(await controller.EquipItem("frame_amethyst")).Value);
        Assert.Equal("frame_amethyst", equipped.EquippedFrameId);

        var above = await controller.EquipItem("frame_sapphire");
        Assert.IsType<NotFoundObjectResult>(above);

        var retired = await controller.EquipItem("frame_gold_crown");
        Assert.IsType<NotFoundObjectResult>(retired);

        Db.ChangeTracker.Clear();
        Assert.Equal("frame_amethyst", (await Db.Users.FindAsync(userId))!.EquippedFrameId);
    }

    [Fact]
    public async Task EquipItem_TitleNotHeld_IsNotOwned()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildController(userId).EquipItem("title_sealbreaker");

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
