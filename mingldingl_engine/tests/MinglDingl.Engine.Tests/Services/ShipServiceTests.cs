using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Services;

public class ShipServiceTests : Integration.IntegrationTestBase
{
    private ShipService BuildService(SupabaseBroadcastService? broadcast = null)
    {
        var scoreService = new ScoreService(Db, new ConfigService());
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = BuildTestPush();
        return new ShipService(Db, new HonourService(Db, NullLogger<HonourService>.Instance), scoreService, new ConfigService(), milestones, push, broadcast ?? BuildTestBroadcast(), NullLogger<ShipService>.Instance);
    }

    // Gendered explicitly: a Fated Thread now resolves its nominees through MatchEligibility, and
    // every NewCompleteUser is Female, so a same-gender pair correctly refuses to spark.
    private User AddUser(string phone, string gender = "Female")
    {
        var user = NewCompleteUser(gender: gender);
        user.PhoneNumber = phone;
        Db.Users.Add(user);
        return user;
    }

    [Fact]
    public async Task CreateAsync_BothPhonesUnknown_CreatesAwaitingUserSlotsWithInviteCodes()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, _, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

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
    public async Task CreateAsync_BothPhonesKnown_ResolvesToPendingOptInImmediatelyAndMintsNoCodes()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();

        var (success, _, _, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);

        // Both nominees are invited in-app, so there is no code to hand the Weaver — and a code
        // returned here would not be stored on the ship, so it could never resolve.
        Assert.Null(slotACode);
        Assert.Null(slotBCode);
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Equal(a.Id, ship.SlotAUserId);
        Assert.Equal(b.Id, ship.SlotBUserId);
        Assert.Equal("PendingOptIn", ship.SlotAOptIn);
        Assert.Equal("PendingOptIn", ship.SlotBOptIn);

        Assert.Null(ship.SlotAInviteCode);
        Assert.Null(ship.SlotBInviteCode);
    }

    [Fact]
    public async Task CreateAsync_SelfNomination_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, _, _, _) = await BuildService().CreateAsync(weaver.Id, "88110001", "88110002");

        Assert.False(success);
        Assert.NotNull(error);
        Db.ChangeTracker.Clear();
        // Scoped to this test's own fixtures: the assertion used to query the whole table,
        // so it only held on an empty database.
        Assert.Empty(Db.Ships.Where(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task CreateAsync_SamePhoneBothSlots_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error, _, _, _) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110002");

        Assert.False(success);
        Assert.NotNull(error);
        Db.ChangeTracker.Clear();
        // Scoped to this test's own fixtures: the assertion used to query the whole table,
        // so it only held on an empty database.
        Assert.Empty(Db.Ships.Where(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task CreateAsync_PairAlreadyMatched_SilentlySucceedsWithoutCreatingAShipRow()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var (success, error, _, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Assert.Null(slotACode);
        Assert.Null(slotBCode);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships.Where(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task CreateAsync_ResolvedSlotHasBlockedTheShipper_SilentlySucceedsWithoutCreatingAShipRow()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = a.Id, BlockedId = weaver.Id });
        await Db.SaveChangesAsync();

        var (success, error, _, slotACode, slotBCode) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Assert.Null(slotACode);
        Assert.Null(slotBCode);
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
            var (success, _, _, _, _) = await service.CreateAsync(weaver.Id, $"8811{1000 + i}", $"8811{2000 + i}");
            Assert.True(success);
        }

        var (fourthSuccess, fourthError, _, _, _) = await service.CreateAsync(weaver.Id, "88113000", "88114000");

        Assert.False(fourthSuccess);
        Assert.NotNull(fourthError);
    }

    [Fact]
    public async Task RespondAsync_OneAcceptsOneDeclines_ClosesQuietlyWithoutSparking()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
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

    /// <summary>
    /// A woven thread is the third path that can create a Match, and it was the only one that never
    /// asked whether the two may be matched at all — so it could pair two people of the same gender,
    /// or someone paused or banned, straight past the rule discovery and POST /matches both obey.
    /// </summary>
    [Fact]
    public async Task RespondAsync_BothAcceptButNomineesAreIneligible_ExpiresInsteadOfSparking()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        b.IsBanned = true;
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        var sparked = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(sparked);
        Db.ChangeTracker.Clear();
        Assert.Equal("Expired", (await Db.Ships.FindAsync(ship.Id))!.Status);
        Assert.Empty(Db.Matches.Where(m => m.ShipId == ship.Id));
    }

    [Fact]
    public async Task RespondAsync_SameGenderNominees_ExpiresInsteadOfSparking()
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
        var sparked = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(sparked);
        Db.ChangeTracker.Clear();
        Assert.Equal("Expired", (await Db.Ships.FindAsync(ship.Id))!.Status);
    }

    [Fact]
    public async Task RespondAsync_BothAccept_SparksAMatchAndRewardsTheWeaver()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
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

    private sealed class FailingHonourService : HonourService
    {
        private readonly AppDbContext _db;
        public FailingHonourService(AppDbContext db)
            : base(db, NullLogger<HonourService>.Instance) => _db = db;

        public override Task<DroppedItem?> GrantAsync(Guid userId, string honourId, string source)
        {
            _db.ChangeTracker.Clear();
            return Task.FromResult<DroppedItem?>(null);
        }
    }

    [Fact]
    public async Task RespondAsync_HonourGrantFails_ResultMatchIdStillPersisted()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();

        var scoreService = new ScoreService(Db, new ConfigService());
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = BuildTestPush();
        var service = new ShipService(Db, new FailingHonourService(Db), scoreService,
            new ConfigService(), milestones, push, BuildTestBroadcast(), NullLogger<ShipService>.Instance);

        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        var sparked = await service.RespondAsync(b.Id, ship.Id, accept: true);
        Assert.True(sparked);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        var match = await Db.Matches.FirstAsync(m => m.ShipId == ship.Id);
        Assert.Equal("Sparked", reloaded!.Status);
        Assert.Equal(match.Id, reloaded.ResultMatchId);
        Assert.Null(reloaded.ShipperRewardItemId);
    }

    [Fact]
    public async Task RespondAsync_SparkGrantsFirstMatchMilestoneToBothNominees()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
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
        var b = AddUser("88110003", "Male");
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
        var b = AddUser("88110003", "Male");
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
        await service.CreateAsync(weaver.Id, "88119999", "88118888");
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
    }

    [Fact]
    public async Task RespondAsync_PairBecameMatchedBetweenCreationAndSpark_ExpiresInsteadOfDuplicating()
    {
        var weaver = AddUser("88110001");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88119999", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        var code = ship.SlotAInviteCode!;
        var a = AddUser("88119999");
        await Db.SaveChangesAsync();
        await service.TryResolveInviteCodeAsync(a.Id, code);

        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Expired", reloaded!.Status);

        Assert.Single(Db.Matches.Where(m => m.InitiatorId == a.Id && m.ReceiverId == b.Id));
    }
    [Fact]
    public async Task RespondAsync_BothAcceptButNomineesBlockedEachOther_DoesNotSpark()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = a.Id, BlockedId = b.Id });
        await Db.SaveChangesAsync();

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.NotEqual("Sparked", reloaded!.Status);
        Assert.Empty(Db.Matches.Where(m => m.ShipId == ship.Id));
    }

    [Fact]
    public async Task RespondAsync_BothAcceptButBlockedInReverseDirection_DoesNotSpark()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = b.Id, BlockedId = a.Id });
        await Db.SaveChangesAsync();

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Matches.Where(m => m.ShipId == ship.Id));
    }

    [Fact]
    public async Task RespondAsync_BothAccept_BroadcastsMatchCreatedWithShipSource()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003", "Male");
        await Db.SaveChangesAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = BuildService(broadcast);
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        Assert.Null(handler.LastRequestBody);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        var match = await Db.Matches.FirstAsync(m => m.ShipId == ship.Id);
        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("\"app-nudges\"", handler.LastRequestBody);
        Assert.Contains("\"match_created\"", handler.LastRequestBody);
        Assert.Contains($"\"matchId\":\"{match.Id}\"", handler.LastRequestBody);
        Assert.Contains($"\"userIds\":[\"{match.InitiatorId}\",\"{match.ReceiverId}\"]", handler.LastRequestBody);
        Assert.Contains("\"source\":\"ship\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_BindsTheSlotWhenTheNumberMatchesTheOneNominated()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        var (_, _, _, slotACode, _) = await service.CreateAsync(weaver.Id, "88110002", "88110003");

        var newcomer = AddUser("88110002", gender: "Male");
        await Db.SaveChangesAsync();

        await service.TryResolveInviteCodeAsync(newcomer.Id, slotACode);

        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(sh => sh.ShipperUserId == weaver.Id);
        Assert.Equal(newcomer.Id, ship.SlotAUserId);
        Assert.Equal("PendingOptIn", ship.SlotAOptIn);
        // The number has done its job, so the Ship stops holding a copy of it.
        Assert.Null(ship.SlotAPhoneNumber);
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_RefusesSomeoneElsesCode()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        var (_, _, _, slotACode, _) = await service.CreateAsync(weaver.Id, "88110002", "88110003");

        // A code is only 31^6, and GET /public/ship-invite will confirm a guess — so on its own it
        // was a bearer token that put whoever presented it into someone else's thread.
        var stranger = AddUser("88119999", gender: "Male");
        await Db.SaveChangesAsync();

        await service.TryResolveInviteCodeAsync(stranger.Id, slotACode);

        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(sh => sh.ShipperUserId == weaver.Id);
        Assert.Null(ship.SlotAUserId);
        Assert.Equal(slotACode, ship.SlotAInviteCode);
        Assert.Equal("AwaitingUser", ship.SlotAOptIn);
    }

    [Fact]
    public async Task CreateAsync_RecordsTheNominatedNumberOnlyForSlotsStillAwaitingTheirPerson()
    {
        var weaver = AddUser("88110001");
        var known = AddUser("88110002", gender: "Male");
        await Db.SaveChangesAsync();

        await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(sh => sh.ShipperUserId == weaver.Id);
        Assert.Equal(known.Id, ship.SlotAUserId);
        Assert.Null(ship.SlotAPhoneNumber);
        Assert.Equal("88110003", ship.SlotBPhoneNumber);
    }
}
