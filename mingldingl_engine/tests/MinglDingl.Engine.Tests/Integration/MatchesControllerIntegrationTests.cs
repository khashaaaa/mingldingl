using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class MatchesControllerIntegrationTests : IntegrationTestBase
{
    private MatchesController BuildController(Guid userId, ConfigService? config = null)
    {
        config ??= new ConfigService();
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
        var push = BuildTestPush();
        var controller = new MatchesController(Db, score, ghosting, quests, milestones, push, config, BuildTestBroadcast())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    /// <summary>
    /// Banning stops the banned account's own requests and nothing else, so before MatchEligibility
    /// learned about IsBanned a suspended profile stayed in everyone's feed — and summoning one
    /// spent a real daily slot on a match that could never be answered.
    /// </summary>
    [Fact]
    public async Task GetCandidates_BannedProfile_IsNotOffered()
    {
        var meId = Guid.NewGuid();
        var me = NewCompleteUser(meId, "Male");
        var banned = NewCompleteUser(Guid.NewGuid(), "Female");
        banned.IsBanned = true;
        banned.BannedAt = DateTime.UtcNow;
        Db.Users.AddRange(me, banned);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController(meId).GetCandidates());
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.DoesNotContain(page.Items, c => c.Id == banned.Id);
    }

    /// <summary>
    /// The located branch of the candidate pool's pre-ranking, which orders in SQL by a degree-space
    /// proximity proxy so the pool cap drops the far-away rather than the arbitrary. Exercised here
    /// because a Math.Abs the provider cannot translate would only fail at runtime.
    /// </summary>
    [Fact]
    public async Task GetCandidates_CallerHasCoordinates_RanksNearerProfilesFirst()
    {
        var meId = Guid.NewGuid();
        var me = NewCompleteUser(meId, "Male");
        me.Latitude = 47.9184;
        me.Longitude = 106.9177; // Ulaanbaatar

        var near = NewCompleteUser(Guid.NewGuid(), "Female");
        near.Latitude = 47.93;
        near.Longitude = 106.93;

        var far = NewCompleteUser(Guid.NewGuid(), "Female");
        far.Latitude = 43.5708;
        far.Longitude = 104.4250; // Dalanzadgad

        Db.Users.AddRange(me, far, near);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController(meId).GetCandidates());
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        // Relative, not absolute: this runs against the shared development database, so seeded
        // Ulaanbaatar profiles legitimately outrank both of these.
        int nearIndex = page.Items.ToList().FindIndex(c => c.Id == near.Id);
        int farIndex = page.Items.ToList().FindIndex(c => c.Id == far.Id);
        Assert.True(nearIndex >= 0 && farIndex >= 0, "both seeded candidates should be offered");
        Assert.True(nearIndex < farIndex, $"the nearer profile should rank first (near {nearIndex}, far {farIndex})");
    }

    [Fact]
    public async Task RequestMatch_TargetIsBanned_IsRefusedAndSpendsNoBudget()
    {
        var meId = Guid.NewGuid();
        var me = NewCompleteUser(meId, "Male");
        var banned = NewCompleteUser(Guid.NewGuid(), "Female");
        banned.IsBanned = true;
        Db.Users.AddRange(me, banned);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<ObjectResult>(
            await BuildController(meId).RequestMatch(new RequestMatchDto(banned.Id)));

        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        Db.ChangeTracker.Clear();
        var after = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == meId);
        Assert.Equal(0, after.DailyMatchesUsed);
        Assert.False(await Db.Matches.AnyAsync(m => m.ReceiverId == banned.Id));
    }

    /// <summary>
    /// BlockedUsers carries a unique index, and Block checked for the row before adding it — so two
    /// taps racing each other turned the loser's insert into a logged 500 rather than a no-op.
    /// </summary>
    [Fact]
    public async Task Block_WhenTheBlockRowAlreadyExists_StillUnmatchesWithoutFailing()
    {
        var meId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(meId, "Male"), NewCompleteUser(otherId, "Female"));
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = meId, ReceiverId = otherId, Status = "Active", RevealLevel = 1 };
        Db.Matches.Add(match);
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = meId, BlockedId = otherId });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();

        Assert.IsType<OkObjectResult>(await BuildController(meId).Block(match.Id));

        Db.ChangeTracker.Clear();
        Assert.Equal("Unmatched", (await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id)).Status);
        Assert.Equal(1, await Db.BlockedUsers.CountAsync(b => b.BlockerId == meId && b.BlockedId == otherId));
    }

    [Fact]
    public async Task GetMyMatches_SilverMembership_SeesDeepProfileFields()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.MembershipLevel = "Silver";

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.HasKids = false;
        other.SmokingHabit = "Never";

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = viewerId,
            ReceiverId = otherId,
            Status = "Active",
            // A balanced exchange: the deep rung is only reachable by a real two-way conversation.
            MessageCount = 30,
            InitiatorMessageCount = 15,
            ReceiverMessageCount = 15,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        var response = Assert.Single(body.Items);
        Assert.NotNull(response.OtherUser.Deep);
        Assert.Equal(false, response.OtherUser.Deep!.HasKids);
        Assert.Equal("Never", response.OtherUser.Deep!.SmokingHabit);
    }

    [Fact]
    public async Task GetMyMatches_FreeMembership_DoesNotSeeDeepProfileFields()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.HasKids = false;

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = viewerId,
            ReceiverId = otherId,
            Status = "Active",
            MessageCount = 30,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        var response = Assert.Single(body.Items);
        Assert.Null(response.OtherUser.Deep);
    }

    [Fact]
    public async Task GetMyMatches_ExposesFlameRiteFieldsWithDistinctValues()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);

        var proposedAt = new DateTime(2026, 8, 19, 9, 0, 0, DateTimeKind.Utc);
        var acceptedAt = new DateTime(2026, 8, 19, 9, 5, 0, DateTimeKind.Utc);
        var completedAt = new DateTime(2026, 8, 19, 9, 10, 0, DateTimeKind.Utc);

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = viewerId,
            ReceiverId = otherId,
            Status = "Active",
            FlameRiteProposedById = otherId,
            FlameRiteProposedAt = proposedAt,
            FlameRiteAcceptedAt = acceptedAt,
            FlameRiteCompletedAt = completedAt,
        });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        config.Set("dating.flamerite.duration_minutes", "7");
        config.Set("dating.flamerite.required", "false");

        var controller = BuildController(viewerId, config);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        var response = Assert.Single(body.Items);
        Assert.Equal(otherId, response.FlameRiteProposedById);
        Assert.Equal(proposedAt, response.FlameRiteProposedAt);
        Assert.Equal(acceptedAt, response.FlameRiteAcceptedAt);
        Assert.Equal(completedAt, response.FlameRiteCompletedAt);
        Assert.Equal(7, response.FlameRiteDurationMinutes);
        Assert.False(response.FlameRiteRequired);
    }

    [Fact]
    public async Task GetCandidates_ExposesOathAndOathProvenOnTheCard()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.Gender = "Female";
        other.Oath = "Bond";
        other.OathProven = true;

        Db.Users.AddRange(viewer, other);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var candidate = body.Items.Single(c => c.Id == otherId);
        Assert.Equal("Bond", candidate.Oath);
        Assert.True(candidate.OathProven);
    }

    [Fact]
    public async Task GetMyMatches_BelowRevealLevel1_OathIsNull()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.Oath = "Bond";
        other.OathProven = true;

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = viewerId,
            ReceiverId = otherId,
            Status = "Active",
            MessageCount = 0,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        var response = Assert.Single(body.Items);
        Assert.Null(response.OtherUser.Oath);
        Assert.False(response.OtherUser.OathProven);
    }

    [Fact]
    public async Task GetMyMatches_AtRevealLevel1_OathIsPopulated()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);

        var otherId = Guid.NewGuid();
        var other = NewCompleteUser(otherId);
        other.Oath = "Bond";
        other.OathProven = true;

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = viewerId,
            ReceiverId = otherId,
            Status = "Active",
            MessageCount = 1,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        var response = Assert.Single(body.Items);
        Assert.Equal("Bond", response.OtherUser.Oath);
        Assert.True(response.OtherUser.OathProven);
    }

    [Fact]
    public async Task GetCandidates_OrdersByDistanceAscending()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;

        var nearId = Guid.NewGuid();
        var near = NewCompleteUser(nearId);
        near.Gender = "Male";
        near.Latitude = 47.9184; near.Longitude = 106.9153;

        var farId = Guid.NewGuid();
        var far = NewCompleteUser(farId);
        far.Gender = "Male";
        far.Latitude = 48.9700; far.Longitude = 89.9500;

        Db.Users.AddRange(viewer, near, far);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);

        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var nearIndex = body.Items.FindIndex(c => c.Id == nearId);
        var farIndex = body.Items.FindIndex(c => c.Id == farId);
        Assert.True(nearIndex >= 0 && farIndex >= 0, "both candidates should be present");
        Assert.True(nearIndex < farIndex, "the nearer candidate should rank ahead of the farther one");
    }

    [Fact]
    public async Task GetCandidates_NoLocation_SortsLastButStillIncluded()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;

        var locatedId = Guid.NewGuid();
        var located = NewCompleteUser(locatedId);
        located.Gender = "Male";
        located.Latitude = 48.9700; located.Longitude = 89.9500;

        var unlocatedId = Guid.NewGuid();
        var unlocated = NewCompleteUser(unlocatedId);
        unlocated.Gender = "Male";

        Db.Users.AddRange(viewer, located, unlocated);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var locatedIndex = body.Items.FindIndex(c => c.Id == locatedId);
        var unlocatedIndex = body.Items.FindIndex(c => c.Id == unlocatedId);
        Assert.True(locatedIndex >= 0 && unlocatedIndex >= 0, "both candidates should be present");
        Assert.True(locatedIndex < unlocatedIndex, "the located candidate should rank ahead of the unlocated one");
    }

    [Fact]
    public async Task GetCandidates_TiedOnDistanceAndScore_RanksMoreCompatibleFirst()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.HasKids = false;
        viewer.SmokingHabit = "Never";
        viewer.DrinkingHabit = "Never";
        viewer.Religion = "None";
        viewer.Lifestyle = "Balanced";

        var incompatibleId = Guid.NewGuid();
        var incompatible = NewCompleteUser(incompatibleId);
        incompatible.HasKids = true;
        incompatible.SmokingHabit = "Regularly";
        incompatible.DrinkingHabit = "Regularly";
        incompatible.Religion = "Christian";
        incompatible.Lifestyle = "Active";

        var compatibleId = Guid.NewGuid();
        var compatible = NewCompleteUser(compatibleId);
        compatible.HasKids = false;
        compatible.SmokingHabit = "Never";
        compatible.DrinkingHabit = "Never";
        compatible.Religion = "None";
        compatible.Lifestyle = "Balanced";

        Db.Users.AddRange(viewer, incompatible, compatible);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var compatibleIndex = body.Items.FindIndex(c => c.Id == compatibleId);
        var incompatibleIndex = body.Items.FindIndex(c => c.Id == incompatibleId);
        Assert.True(compatibleIndex >= 0 && incompatibleIndex >= 0, "both candidates should be present");
        Assert.True(compatibleIndex < incompatibleIndex, "the more deep-field-compatible candidate should rank ahead");
    }

    [Fact]
    public async Task GetCandidates_GoldMembership_PrioritizesCompatibilityWithinDistanceBand()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.MembershipLevel = "Gold";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;
        viewer.SmokingHabit = "Never";

        var nearIncompatibleId = Guid.NewGuid();
        var nearIncompatible = NewCompleteUser(nearIncompatibleId);
        nearIncompatible.Latitude = 47.9328; nearIncompatible.Longitude = 106.9522;
        nearIncompatible.SmokingHabit = "Regularly";

        var farCompatibleId = Guid.NewGuid();
        var farCompatible = NewCompleteUser(farCompatibleId);
        farCompatible.Latitude = 47.9828; farCompatible.Longitude = 106.9522;
        farCompatible.SmokingHabit = "Never";

        Db.Users.AddRange(viewer, nearIncompatible, farCompatible);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var farCompatibleIndex = body.Items.FindIndex(c => c.Id == farCompatibleId);
        var nearIncompatibleIndex = body.Items.FindIndex(c => c.Id == nearIncompatibleId);
        Assert.True(farCompatibleIndex >= 0 && nearIncompatibleIndex >= 0, "both candidates should be present");
        Assert.True(farCompatibleIndex < nearIncompatibleIndex, "for Gold, compatibility should outrank raw distance within the same band");
    }

    [Fact]
    public async Task GetCandidates_FreeMembership_IgnoresDistanceBanding_NearestFirstRegardlessOfCompatibility()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;
        viewer.SmokingHabit = "Never";

        var nearIncompatibleId = Guid.NewGuid();
        var nearIncompatible = NewCompleteUser(nearIncompatibleId);
        nearIncompatible.Latitude = 47.9328; nearIncompatible.Longitude = 106.9522;
        nearIncompatible.SmokingHabit = "Regularly";

        var farCompatibleId = Guid.NewGuid();
        var farCompatible = NewCompleteUser(farCompatibleId);
        farCompatible.Latitude = 47.9828; farCompatible.Longitude = 106.9522;
        farCompatible.SmokingHabit = "Never";

        Db.Users.AddRange(viewer, nearIncompatible, farCompatible);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var farCompatibleIndex = body.Items.FindIndex(c => c.Id == farCompatibleId);
        var nearIncompatibleIndex = body.Items.FindIndex(c => c.Id == nearIncompatibleId);
        Assert.True(farCompatibleIndex >= 0 && nearIncompatibleIndex >= 0, "both candidates should be present");
        Assert.True(nearIncompatibleIndex < farCompatibleIndex, "for Free, raw distance should still win — the priority perk must not leak to non-paying users");
    }

    [Fact]
    public async Task GetCandidates_UnmatchedCandidateWithinBand_RanksAheadOfAlreadyMatchedCandidate()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;

        var unmatchedId = Guid.NewGuid();
        var unmatched = NewCompleteUser(unmatchedId);
        unmatched.Latitude = 47.9184; unmatched.Longitude = 106.9153;

        var alreadyMatchedId = Guid.NewGuid();
        var alreadyMatched = NewCompleteUser(alreadyMatchedId);
        alreadyMatched.Latitude = 47.9130; alreadyMatched.Longitude = 106.9520;

        var thirdPartyId = Guid.NewGuid();
        var thirdParty = NewCompleteUser(thirdPartyId);

        Db.Users.AddRange(viewer, unmatched, alreadyMatched, thirdParty);
        Db.Matches.Add(new Match { InitiatorId = alreadyMatchedId, ReceiverId = thirdPartyId, Status = "Active" });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var unmatchedIndex = body.Items.FindIndex(c => c.Id == unmatchedId);
        var alreadyMatchedIndex = body.Items.FindIndex(c => c.Id == alreadyMatchedId);
        Assert.True(unmatchedIndex >= 0 && alreadyMatchedIndex >= 0, "both candidates should be present");
        Assert.True(unmatchedIndex < alreadyMatchedIndex, "the never-matched candidate should be boosted ahead of the already-matched one within the same band");
    }

    [Fact]
    public async Task GetCandidates_UnmatchedBoost_DoesNotOverrideACloserCandidateInAnotherBand()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;

        var nearAlreadyMatchedId = Guid.NewGuid();
        var nearAlreadyMatched = NewCompleteUser(nearAlreadyMatchedId);
        nearAlreadyMatched.Latitude = 47.9184; nearAlreadyMatched.Longitude = 106.9153;

        var farUnmatchedId = Guid.NewGuid();
        var farUnmatched = NewCompleteUser(farUnmatchedId);
        farUnmatched.Latitude = 48.9700; farUnmatched.Longitude = 89.9500;

        var thirdPartyId = Guid.NewGuid();
        var thirdParty = NewCompleteUser(thirdPartyId);

        Db.Users.AddRange(viewer, nearAlreadyMatched, farUnmatched, thirdParty);
        Db.Matches.Add(new Match { InitiatorId = nearAlreadyMatchedId, ReceiverId = thirdPartyId, Status = "Active" });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        var nearIndex = body.Items.FindIndex(c => c.Id == nearAlreadyMatchedId);
        var farIndex = body.Items.FindIndex(c => c.Id == farUnmatchedId);
        Assert.True(nearIndex >= 0 && farIndex >= 0, "both candidates should be present");
        Assert.True(nearIndex < farIndex, "raw distance across bands must still win over the same-band-only boost");
    }

    [Fact]
    public async Task Block_EndsMatchAndPreventsFutureMatchRequest()
    {
        var blockerId = Guid.NewGuid();
        var blockedId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(blockerId), NewCompleteUser(blockedId));
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = blockerId, ReceiverId = blockedId, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var controller = BuildController(blockerId);
        await controller.Block(match.Id);

        Db.ChangeTracker.Clear();
        var reloadedMatch = await Db.Matches.FindAsync(match.Id);
        Assert.Equal("Unmatched", reloadedMatch!.Status);
        Assert.True(await Db.BlockedUsers.AnyAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId));

        bool blockedEitherDirection = await Db.BlockedUsers.AnyAsync(bl =>
            (bl.BlockerId == blockedId && bl.BlockedId == blockerId) ||
            (bl.BlockerId == blockerId && bl.BlockedId == blockedId));
        Assert.True(blockedEitherDirection, "RequestMatch's guard should see this pair as blocked regardless of who initiates");
    }

    [Fact]
    public async Task Unmatch_BroadcastsMatchStatusChanged()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(userId), NewCompleteUser(otherId));
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = userId, ReceiverId = otherId, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var (broadcast, handler) = BuildCapturingBroadcast();
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new HonourService(Db, NullLogger<HonourService>.Instance));
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var controller = new MatchesController(Db, score, new GhostingService(Db, score, oaths, broadcast, config, BuildTestPush()), quests, milestones,
            BuildTestPush(), config, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };

        Assert.IsType<OkObjectResult>(await controller.Unmatch(match.Id));

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("\"app-nudges\"", handler.LastRequestBody);
        Assert.Contains("\"match_status_changed\"", handler.LastRequestBody);
        Assert.Contains("\"status\":\"Unmatched\"", handler.LastRequestBody);
        Assert.Contains($"\"matchId\":\"{match.Id}\"", handler.LastRequestBody);
        Assert.Contains($"\"userId\":\"{userId}\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task GetCandidates_ExcludesBlockedUsers_EvenWithoutAMatch()
    {
        var viewerId = Guid.NewGuid();
        var blockedId = Guid.NewGuid();
        var blockedUser = NewCompleteUser(blockedId);
        blockedUser.Gender = "Male";
        Db.Users.AddRange(NewCompleteUser(viewerId), blockedUser);
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = viewerId, BlockedId = blockedId });
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.DoesNotContain(body.Items, c => c.Id == blockedId);
    }

    [Fact]
    public async Task GetCandidates_OppositeGenderOnly()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";

        var femaleId = Guid.NewGuid();
        var female = NewCompleteUser(femaleId);
        female.Gender = "Female";

        var maleId = Guid.NewGuid();
        var male = NewCompleteUser(maleId);
        male.Gender = "Male";

        Db.Users.AddRange(viewer, female, male);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.Contains(body.Items, c => c.Id == femaleId);
        Assert.DoesNotContain(body.Items, c => c.Id == maleId);
    }

    [Fact]
    public async Task GetCandidates_FiltersByViewersAgeRange()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.AgeMin = 25;
        viewer.AgeMax = 35;

        var inRangeId = Guid.NewGuid();
        var inRange = NewCompleteUser(inRangeId);
        inRange.Gender = "Female";
        inRange.Age = 30;

        var tooYoungId = Guid.NewGuid();
        var tooYoung = NewCompleteUser(tooYoungId);
        tooYoung.Gender = "Female";
        tooYoung.Age = 20;

        Db.Users.AddRange(viewer, inRange, tooYoung);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.Contains(body.Items, c => c.Id == inRangeId);
        Assert.DoesNotContain(body.Items, c => c.Id == tooYoungId);
    }

    [Fact]
    public async Task GetCandidates_ExcludesPausedUsers()
    {
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";

        var pausedId = Guid.NewGuid();
        var paused = NewCompleteUser(pausedId);
        paused.Gender = "Female";
        paused.IsPaused = true;

        Db.Users.AddRange(viewer, paused);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.DoesNotContain(body.Items, c => c.Id == pausedId);
    }

    [Fact]
    public async Task GetMyMatches_ShipOriginatedMatch_IncludesWeaverDisplayName()
    {
        var weaver = NewCompleteUser();
        weaver.DisplayName = "Bataar";
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(weaver, a, b);
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship { Id = Guid.NewGuid(), ShipperUserId = weaver.Id, Status = "Sparked", SlotAUserId = a.Id, SlotBUserId = b.Id });
        await Db.SaveChangesAsync();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1, ShipId = ship.Id });
        await Db.SaveChangesAsync();

        var result = await BuildController(a.Id).GetMyMatches();

        var response = Assert.IsType<PagedResponse<MatchResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal("Bataar", response.Items[0].WeaverDisplayName);
    }

    [Fact]
    public async Task GetMyMatches_OrdinaryMatch_WeaverDisplayNameIsNull()
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        await Db.SaveChangesAsync();
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var result = await BuildController(a.Id).GetMyMatches();

        var response = Assert.IsType<PagedResponse<MatchResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Null(response.Items[0].WeaverDisplayName);
    }

    /// <summary>
    /// A summon must be limited to someone discovery would actually have offered. These guards all
    /// lived only in GetCandidates, so a direct POST reached paused accounts, accounts pending
    /// deletion, people outside the caller's stated age range, and the caller themselves.
    /// </summary>
    private async Task<(MatchesController Controller, Guid MeId)> SeedSuitor(Action<User>? tweak = null)
    {
        var meId = Guid.NewGuid();
        var me = NewCompleteUser(meId);
        me.Gender = "Male";
        me.Age = 30;
        me.AgeMin = 25;
        me.AgeMax = 35;
        tweak?.Invoke(me);
        Db.Users.Add(me);
        await Db.SaveChangesAsync();
        return (BuildController(meId), meId);
    }

    [Fact]
    public async Task RequestMatch_TargetIsSelf_IsRejected()
    {
        var (controller, meId) = await SeedSuitor();

        var result = await controller.RequestMatch(new RequestMatchDto(meId));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await Db.Matches.AnyAsync(m => m.InitiatorId == meId && m.ReceiverId == meId));
    }

    [Fact]
    public async Task RequestMatch_TargetDoesNotExist_IsNotFoundRatherThanAnUnhandledFailure()
    {
        var (controller, _) = await SeedSuitor();

        var result = await controller.RequestMatch(new RequestMatchDto(Guid.NewGuid()));

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task RequestMatch_TargetHasRequestedDeletion_IsRejected()
    {
        var (controller, meId) = await SeedSuitor();
        var target = NewCompleteUser();
        target.Gender = "Female";
        target.Age = 30;
        target.DeletionRequestedAt = DateTime.UtcNow;
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        var result = await controller.RequestMatch(new RequestMatchDto(target.Id));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
        Assert.False(await Db.Matches.AnyAsync(m => m.ReceiverId == target.Id));
    }

    [Fact]
    public async Task RequestMatch_TargetIsPaused_IsRejected()
    {
        var (controller, _) = await SeedSuitor();
        var target = NewCompleteUser();
        target.Gender = "Female";
        target.Age = 30;
        target.IsPaused = true;
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        var result = await controller.RequestMatch(new RequestMatchDto(target.Id));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.False(await Db.Matches.AnyAsync(m => m.ReceiverId == target.Id));
    }

    [Fact]
    public async Task RequestMatch_TargetOutsideMyStatedAgeRange_IsRejected()
    {
        var (controller, _) = await SeedSuitor();
        var target = NewCompleteUser();
        target.Gender = "Female";
        target.Age = 55;
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        var result = await controller.RequestMatch(new RequestMatchDto(target.Id));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.False(await Db.Matches.AnyAsync(m => m.ReceiverId == target.Id));
    }

    [Fact]
    public async Task RequestMatch_TargetSharesMyGender_IsRejectedBecauseDiscoveryWouldNeverOfferThem()
    {
        var (controller, _) = await SeedSuitor();
        var target = NewCompleteUser();
        target.Gender = "Male";
        target.Age = 30;
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        var result = await controller.RequestMatch(new RequestMatchDto(target.Id));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetCandidates_AllElseEqual_ShowsSomeoneNobodyHasMatchedYetFirst()
    {
        // The new-user boost. Untested until now, and the next change replaces how it is computed
        // (it loaded every match participant in the database into memory to answer it).
        var meId = Guid.NewGuid();
        var me = NewCompleteUser(meId);
        me.Gender = "Male";
        me.Age = 30;
        me.Latitude = 47.92;
        me.Longitude = 106.92;
        me.Oath = null;

        var untouched = NewCompleteUser();
        var spokenFor = NewCompleteUser();
        var thirdParty = NewCompleteUser();
        foreach (var u in new[] { untouched, spokenFor, thirdParty })
        {
            u.Gender = "Female";
            u.Age = 30;
            u.Latitude = 47.92;
            u.Longitude = 106.92;
            u.Oath = null;
            u.TotalScore = me.TotalScore;
        }
        thirdParty.Gender = "Male";

        Db.Users.AddRange(me, untouched, spokenFor, thirdParty);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(), InitiatorId = thirdParty.Id, ReceiverId = spokenFor.Id, Status = "Active",
        });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController(meId).GetCandidates());
        var items = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value).Items;

        var ranked = items.Where(i => i.Id == untouched.Id || i.Id == spokenFor.Id).ToList();
        Assert.Equal(2, ranked.Count);
        Assert.Equal(untouched.Id, ranked[0].Id);
    }

    [Fact]
    public async Task GetMyMatches_ReportsHowManyPhotosTheOtherPersonActuallyHas()
    {
        // Without this the app cannot tell "not revealed yet" from "there is no third photo", so a
        // two-photo profile showed a padlock on the third slot that no conversation could ever open.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        var other = NewCompleteUser();
        other.PhotoUrls = ["/uploads/photos/1.jpg", "/uploads/photos/2.jpg"];

        Db.Users.AddRange(viewer, other);
        Db.Matches.Add(new Match
        {
            Id = Guid.NewGuid(), InitiatorId = viewerId, ReceiverId = other.Id, Status = "Active",
        });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController(viewerId).GetMyMatches());
        var body = Assert.IsType<PagedResponse<MatchResponse>>(result.Value);

        Assert.Equal(2, Assert.Single(body.Items).OtherUser.PhotoCount);
    }

    [Fact]
    public async Task Matches_ASecondRowForTheSamePairInEitherOrder_IsRefusedByTheDatabase()
    {
        var a = NewCompleteUser(gender: "Male");
        var b = NewCompleteUser(gender: "Female");
        Db.Users.AddRange(a, b);
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active" });
        await Db.SaveChangesAsync();

        // A pair holds at most one Match, ever. Until this index existed the rule lived only in
        // pg_advisory_xact_lock, so a path that forgot to take it — or an execution-strategy retry
        // replaying an insert — produced a silent duplicate instead of an error. Reversed, because
        // the pair is unordered.
        Db.Matches.Add(new Match { InitiatorId = b.Id, ReceiverId = a.Id, Status = "Active" });
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
        Assert.True(UniqueViolationGuard.IsViolation(ex, "ix_matches_pair"));
        Db.ChangeTracker.Clear();
    }
}
