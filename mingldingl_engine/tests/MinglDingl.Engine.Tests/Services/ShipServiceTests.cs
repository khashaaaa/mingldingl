using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Services;

public class ShipServiceTests : Integration.IntegrationTestBase
{
    private ShipService BuildService()
    {
        var scoreService = new ScoreService(Db, new ConfigService());
        var milestones = new MilestoneService(Db);
        var push = new PushNotificationService(new HttpClient(), Db);
        return new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService(), milestones, push);
    }

    private User AddUser(string phone)
    {
        var user = NewCompleteUser();
        user.PhoneNumber = phone;
        Db.Users.Add(user);
        return user;
    }

    [Fact]
    public async Task CreateAsync_BothPhonesUnknown_CreatesAwaitingUserSlotsWithInviteCodes()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Assert.NotNull(slotACode);
        Assert.NotNull(slotBCode);
        Assert.NotEqual(slotACode, slotBCode);
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Equal("AwaitingUser", ship.SlotAOptIn);
        Assert.Equal("AwaitingUser", ship.SlotBOptIn);
        Assert.Equal(slotACode, ship.SlotAInviteCode);
        Assert.Equal(slotBCode, ship.SlotBInviteCode);
        Assert.NotEqual(ship.SlotAInviteCode, ship.SlotBInviteCode);
    }

    [Fact]
    public async Task CreateAsync_BothPhonesKnown_ResolvesToPendingOptInImmediatelyButStillReturnsCodes()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();

        var (success, _, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        // Codes are always returned to the caller — even for slots that
        // resolved to a real account — so the response shape can't be used
        // to distinguish "this phone number is on the app" from "it isn't".
        Assert.NotNull(slotACode);
        Assert.NotNull(slotBCode);
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Equal(a.Id, ship.SlotAUserId);
        Assert.Equal(b.Id, ship.SlotBUserId);
        Assert.Equal("PendingOptIn", ship.SlotAOptIn);
        Assert.Equal("PendingOptIn", ship.SlotBOptIn);
        // But the returned codes for resolved slots are never persisted —
        // they're inert, there's nothing for them to redeem.
        Assert.Null(ship.SlotAInviteCode);
        Assert.Null(ship.SlotBInviteCode);
    }

    [Fact]
    public async Task CreateAsync_SelfNomination_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, _, _) = await BuildService().CreateAsync(weaver.Id, "88110001", "88110002");

        Assert.False(success);
        Assert.NotNull(error);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships);
    }

    [Fact]
    public async Task CreateAsync_SamePhoneBothSlots_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, _, _) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110002");

        Assert.False(success);
        Assert.NotNull(error);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships);
    }

    [Fact]
    public async Task CreateAsync_PairAlreadyMatched_SilentlySucceedsWithoutCreatingAShipRow()
    {
        // Privacy constraint: this outcome must be indistinguishable from a
        // real thread being woven — no error, same codes shape, just no Ship
        // row persisted.
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var (success, error, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Assert.NotNull(slotACode);
        Assert.NotNull(slotBCode);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships.Where(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task CreateAsync_ResolvedSlotHasBlockedTheShipper_SilentlySucceedsWithoutCreatingAShipRow()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = a.Id, BlockedId = weaver.Id });
        await Db.SaveChangesAsync();

        var (success, error, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Assert.NotNull(slotACode);
        Assert.NotNull(slotBCode);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships.Where(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task CreateAsync_DailyCapReached_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        for (int i = 0; i < 3; i++)
        {
            var (success, _, _, _) = await service.CreateAsync(weaver.Id, $"8811{1000 + i}", $"8811{2000 + i}");
            Assert.True(success);
        }

        var (fourthSuccess, fourthError, _, _) = await service.CreateAsync(weaver.Id, "88113000", "88114000");

        Assert.False(fourthSuccess);
        Assert.NotNull(fourthError);
    }

    [Fact]
    public async Task RespondAsync_OneAcceptsOneDeclines_ClosesQuietlyWithoutSparking()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: false);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Declined", reloaded!.Status);
        Assert.Empty(Db.Matches.Where(m => m.ShipId == ship.Id));
    }

    [Fact]
    public async Task RespondAsync_BothAccept_SparksAMatchAndRewardsTheWeaver()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.True(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Sparked", reloaded!.Status);
        Assert.NotNull(reloaded.ShipperRewardItemId);
        var match = await Db.Matches.FirstAsync(m => m.ShipId == ship.Id);
        Assert.Equal(1, match.RevealLevel);
        Assert.Equal("Active", match.Status);

        var weaverAfter = await Db.Users.FindAsync(weaver.Id);
        Assert.True(weaverAfter!.TotalScore >= 40);
    }

    [Fact]
    public async Task RespondAsync_SparkGrantsFirstMatchMilestoneToBothNominees()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserMilestones.Where(m => m.UserId == a.Id && m.MilestoneId == "first_match"));
        Assert.Single(Db.UserMilestones.Where(m => m.UserId == b.Id && m.MilestoneId == "first_match"));
    }

    [Fact]
    public async Task RespondAsync_SparkDoesNotIncrementEitherPartysDailyMatchesUsed()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        Assert.Equal(0, (await Db.Users.FindAsync(a.Id))!.DailyMatchesUsed);
        Assert.Equal(0, (await Db.Users.FindAsync(b.Id))!.DailyMatchesUsed);
    }

    [Fact]
    public async Task RespondAsync_FirstSparkedThread_GrantsThreadweaverTitle()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == weaver.Id && i.ItemId == "title_threadweaver"));
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_MatchingCode_ResolvesTheSlotToPendingOptIn()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88119999", "88118888"); // both AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        var code = ship.SlotAInviteCode!;
        var newUser = AddUser("88119999");
        await Db.SaveChangesAsync();

        await service.TryResolveInviteCodeAsync(newUser.Id, code);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal(newUser.Id, reloaded!.SlotAUserId);
        Assert.Null(reloaded.SlotAInviteCode);
        Assert.Equal("PendingOptIn", reloaded.SlotAOptIn);
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_UnknownCode_NoOps()
    {
        var newUser = AddUser("88119999");
        await Db.SaveChangesAsync();

        await BuildService().TryResolveInviteCodeAsync(newUser.Id, "ZZZZZZ");

        // No exception is the assertion here — nothing to look up afterward.
    }

    [Fact]
    public async Task RespondAsync_PairBecameMatchedBetweenCreationAndSpark_ExpiresInsteadOfDuplicating()
    {
        // Covers the spec's required spark-time recheck: creation-time
        // couldn't reject this pair (slot A was still AwaitingUser then),
        // so the check has to run again right before the match is created.
        var weaver = AddUser("88110001");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88119999", "88110003"); // slot A starts AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        var code = ship.SlotAInviteCode!;
        var a = AddUser("88119999");
        await Db.SaveChangesAsync();
        await service.TryResolveInviteCodeAsync(a.Id, code); // slot A resolves to a real user

        // A and B become matched through an unrelated route before either
        // responds to the ship.
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Expired", reloaded!.Status);
        // Only the one Match that already existed — RespondAsync must not
        // have added a second one for the same pair.
        Assert.Single(Db.Matches.Where(m => m.InitiatorId == a.Id && m.ReceiverId == b.Id));
    }
}
