using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests.Integration;

public class MatchesControllerIntegrationTests : IntegrationTestBase
{
    private MatchesController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var ghosting = new GhostingService(Db, score);
        var quests = new QuestService(Db, score);
        var milestones = new MilestoneService(Db);
        var push = new PushNotificationService(new HttpClient(), Db);
        var controller = new MatchesController(Db, score, ghosting, quests, milestones, push)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task GetMyMatches_SilverMembership_SeesDeepProfileFields()
    {
        // Regression test: MembershipController advertises "Deep profile view"
        // as a Silver perk, but BuildMatchResponse's gate used to only check
        // for Gold/Platinum, so Silver subscribers never actually received
        // the feature they were sold.
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
            MessageCount = 30, // reveal level 4 — deep fields become eligible
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
        var viewer = NewCompleteUser(viewerId); // MembershipLevel defaults to "Free"

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
    public async Task GetCandidates_OrdersByDistanceAscending()
    {
        // Regression test for the 2026-07-27 location-based matching change:
        // distance is the primary Discover ranking signal now, not score
        // proximity. Viewer is in Bayanzürkh (UB); "near" is elsewhere in UB,
        // "far" is Ölgii (the opposite end of the country) — both candidates
        // have identical scores, so only distance can explain the ordering.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522; // Bayanzürkh

        var nearId = Guid.NewGuid();
        var near = NewCompleteUser(nearId);
        near.Gender = "Male"; // opposite-sex-only filter — see 2026-07-28 brainstorm
        near.Latitude = 47.9184; near.Longitude = 106.9153; // Sükhbaatar (UB), a few km away

        var farId = Guid.NewGuid();
        var far = NewCompleteUser(farId);
        far.Gender = "Male";
        far.Latitude = 48.9700; far.Longitude = 89.9500; // Ölgii, ~1000km away

        Db.Users.AddRange(viewer, near, far);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        // Max page size: the shared dev DB has pre-existing seed users too, so
        // this asserts relative ordering of the candidates this test created,
        // not an exact count/position in the full response.
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
        located.Gender = "Male"; // opposite-sex-only filter — see 2026-07-28 brainstorm
        located.Latitude = 48.9700; located.Longitude = 89.9500; // far, but a known distance

        var unlocatedId = Guid.NewGuid();
        var unlocated = NewCompleteUser(unlocatedId); // Latitude/Longitude left null
        unlocated.Gender = "Male";

        Db.Users.AddRange(viewer, located, unlocated);
        await Db.SaveChangesAsync();

        var controller = BuildController(viewerId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(pageSize: 50));
        var body = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        // Soft signal, not a hard filter: the unlocated candidate is never
        // excluded, just ranked after anyone with a resolvable distance.
        var locatedIndex = body.Items.FindIndex(c => c.Id == locatedId);
        var unlocatedIndex = body.Items.FindIndex(c => c.Id == unlocatedId);
        Assert.True(locatedIndex >= 0 && unlocatedIndex >= 0, "both candidates should be present");
        Assert.True(locatedIndex < unlocatedIndex, "the located candidate should rank ahead of the unlocated one");
    }

    [Fact]
    public async Task GetCandidates_TiedOnDistanceAndScore_RanksMoreCompatibleFirst()
    {
        // Deep-field compatibility is a soft signal like distance: it only
        // breaks ties, it never excludes anyone. Both candidates here are
        // unlocated (tied on distance) and have the same TotalScore (tied on
        // score proximity), so only compatibility with the viewer's deep
        // fields can explain the ordering.
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

        // Inserted in "wrong" order deliberately — with no compatibility
        // signal, a stable sort tied on distance/score would preserve this
        // order and put the incompatible candidate first.
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
        // Priority matching (Gold/Platinum perk): within the same ~15km band,
        // a farther-but-more-compatible candidate should outrank a
        // nearer-but-incompatible one — compatibility becomes a real primary
        // ranking factor for paid tiers, not just an exact-tie breaker.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.MembershipLevel = "Gold";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522; // Bayanzürkh
        viewer.SmokingHabit = "Never";

        var nearIncompatibleId = Guid.NewGuid();
        var nearIncompatible = NewCompleteUser(nearIncompatibleId);
        nearIncompatible.Latitude = 47.9328; nearIncompatible.Longitude = 106.9522; // ~2.2km away
        nearIncompatible.SmokingHabit = "Regularly";

        var farCompatibleId = Guid.NewGuid();
        var farCompatible = NewCompleteUser(farCompatibleId);
        farCompatible.Latitude = 47.9828; farCompatible.Longitude = 106.9522; // ~7.8km away, same band
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
        // Same scenario as the Gold test above, but for a Free member — the
        // perk must actually be gated: without it, plain nearest-first still
        // applies, so the incompatible-but-nearer candidate wins.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male"; // MembershipLevel defaults to "Free"
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;
        viewer.SmokingHabit = "Never";

        var nearIncompatibleId = Guid.NewGuid();
        var nearIncompatible = NewCompleteUser(nearIncompatibleId);
        nearIncompatible.Latitude = 47.9328; nearIncompatible.Longitude = 106.9522; // ~2.2km away
        nearIncompatible.SmokingHabit = "Regularly";

        var farCompatibleId = Guid.NewGuid();
        var farCompatible = NewCompleteUser(farCompatibleId);
        farCompatible.Latitude = 47.9828; farCompatible.Longitude = 106.9522; // ~7.8km away
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
        // Day-0 activation lever: a candidate who has never matched with
        // anyone gets boosted within the same ~10km band, ahead of an
        // otherwise-equal candidate who already has a match elsewhere — so a
        // brand-new user surfaces sooner in other people's decks instead of
        // sitting unseen behind everyone who's already been discovered.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522; // Bayanzürkh

        var unmatchedId = Guid.NewGuid();
        var unmatched = NewCompleteUser(unmatchedId);
        unmatched.Latitude = 47.9184; unmatched.Longitude = 106.9153; // a few km away, same band

        var alreadyMatchedId = Guid.NewGuid();
        var alreadyMatched = NewCompleteUser(alreadyMatchedId);
        alreadyMatched.Latitude = 47.9130; alreadyMatched.Longitude = 106.9520; // essentially the same spot, same band

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
        // The boost only reorders within a band — it must never surface a
        // brand-new user over a genuinely closer candidate in a different
        // (10km+) band, which would defeat the point of distance-based
        // matching in a city-scale app.
        var viewerId = Guid.NewGuid();
        var viewer = NewCompleteUser(viewerId);
        viewer.Gender = "Male";
        viewer.Latitude = 47.9128; viewer.Longitude = 106.9522;

        var nearAlreadyMatchedId = Guid.NewGuid();
        var nearAlreadyMatched = NewCompleteUser(nearAlreadyMatchedId);
        nearAlreadyMatched.Latitude = 47.9184; nearAlreadyMatched.Longitude = 106.9153; // ~4km away

        var farUnmatchedId = Guid.NewGuid();
        var farUnmatched = NewCompleteUser(farUnmatchedId);
        farUnmatched.Latitude = 48.9700; farUnmatched.Longitude = 89.9500; // ~1000km away, different band

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

        // RequestMatch's guard checks this exact symmetric predicate before
        // creating a match — asserted directly rather than by calling
        // RequestMatch itself, which opens its own transaction internally
        // (for the advisory lock) and can't nest inside IntegrationTestBase's
        // wrapping transaction.
        bool blockedEitherDirection = await Db.BlockedUsers.AnyAsync(bl =>
            (bl.BlockerId == blockedId && bl.BlockedId == blockerId) ||
            (bl.BlockerId == blockerId && bl.BlockedId == blockedId));
        Assert.True(blockedEitherDirection, "RequestMatch's guard should see this pair as blocked regardless of who initiates");
    }

    [Fact]
    public async Task GetCandidates_ExcludesBlockedUsers_EvenWithoutAMatch()
    {
        var viewerId = Guid.NewGuid();
        var blockedId = Guid.NewGuid();
        var blockedUser = NewCompleteUser(blockedId);
        blockedUser.Gender = "Male"; // opposite gender so the block itself is what excludes them, not the gender filter
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
}
