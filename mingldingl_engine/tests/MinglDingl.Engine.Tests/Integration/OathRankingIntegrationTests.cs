using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class OathRankingIntegrationTests : IntegrationTestBase
{
    private MatchesController BuildMatchesController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);
        var push = new PushNotificationService(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance);
        var controller = new MatchesController(Db, score, ghosting, quests, milestones, push, config, BuildTestBroadcast())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private const double ViewerLat = 47.9128;
    private const double ViewerLon = 106.9522;
    private const double KmPerDegreeLatitude = 111.195;

    private static User NewOathCandidate(string? oath, double? distanceKm = null, bool proven = false)
    {
        var u = NewCompleteUser();
        u.Gender = "Female";
        u.Oath = oath;
        u.OathProven = proven;
        u.IsProfileComplete = true;
        if (distanceKm.HasValue)
        {
            u.Latitude = ViewerLat + distanceKm.Value / KmPerDegreeLatitude;
            u.Longitude = ViewerLon;
        }
        return u;
    }

    private async Task<(Guid MeId, Guid MatchingId, Guid OpposedId, Guid UnswornId)> SeedAsync(
        double? matchingDistanceKm = null, bool matchingProven = false,
        double? opposedDistanceKm = null, bool opposedProven = false,
        bool meProven = false, bool meLocated = false)
    {
        var me = NewCompleteUser();
        me.Gender = "Male"; me.Oath = "Bond"; me.OathProven = meProven;
        if (meLocated) { me.Latitude = ViewerLat; me.Longitude = ViewerLon; }

        var matching = NewOathCandidate("Bond", matchingDistanceKm, matchingProven);
        var opposed = NewOathCandidate("Kinship", opposedDistanceKm, opposedProven);
        var unsworn = NewOathCandidate(null);

        me.IsProfileComplete = true;
        Db.Users.AddRange(me, matching, opposed, unsworn);
        await Db.SaveChangesAsync();
        return (me.Id, matching.Id, opposed.Id, unsworn.Id);
    }

    [Fact]
    public async Task GetCandidates_RanksSharedOathAboveOpposed_AndUnswornLast()
    {
        var (meId, matchingId, opposedId, unswornId) = await SeedAsync();
        var controller = BuildMatchesController(meId);

        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(page: 1, pageSize: 50));
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);
        var order = page.Items.Select(i => i.Id).ToList();

        var seeded = order.Where(id => id == matchingId || id == opposedId || id == unswornId).ToList();
        Assert.Equal(new[] { matchingId, opposedId, unswornId }, seeded);
    }

    [Fact]
    public async Task GetCandidates_ExposesOathOnTheCard()
    {
        var (meId, matchingId, _, _) = await SeedAsync();
        var controller = BuildMatchesController(meId);

        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(page: 1, pageSize: 50));
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);

        Assert.Equal("Bond", page.Items.Single(i => i.Id == matchingId).Oath);
    }

    [Fact]
    public async Task GetCandidates_OathBand_OverridesProximityInsideBandButNotBeyondIt()
    {
        var (meId, matchingId, opposedId, _) = await SeedAsync(
            matchingDistanceKm: 20, opposedDistanceKm: 2, meLocated: true);

        var farMatching = NewOathCandidate("Bond", distanceKm: 40);
        Db.Users.Add(farMatching);
        await Db.SaveChangesAsync();

        var controller = BuildMatchesController(meId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(page: 1, pageSize: 50));
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);
        var order = page.Items.Select(i => i.Id).ToList();

        var matchingIndex = order.IndexOf(matchingId);
        var opposedIndex = order.IndexOf(opposedId);
        var farMatchingIndex = order.IndexOf(farMatching.Id);
        Assert.True(matchingIndex >= 0 && opposedIndex >= 0 && farMatchingIndex >= 0,
            "all three candidates should be present");

        Assert.True(matchingIndex < opposedIndex,
            "the ~20km matching-oath candidate should outrank the ~2km opposed-oath candidate inside the same band");

        Assert.True(opposedIndex < farMatchingIndex,
            "the ~40km matching-oath candidate must not be pulled ahead of the ~2km opposed one — the band bounds the override");
    }

    [Fact]
    public async Task GetCandidates_BothProven_TiebreaksIdenticalOathAndDistance()
    {
        var me = NewCompleteUser();
        me.Gender = "Male"; me.Oath = "Bond"; me.OathProven = true;
        me.Latitude = ViewerLat; me.Longitude = ViewerLon;

        var proven = NewOathCandidate("Bond", distanceKm: 5, proven: true);
        var unproven = NewOathCandidate("Bond", distanceKm: 5, proven: false);

        Db.Users.AddRange(me, unproven, proven);
        await Db.SaveChangesAsync();

        var controller = BuildMatchesController(me.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetCandidates(page: 1, pageSize: 50));
        var page = Assert.IsType<PagedResponse<CandidateResponse>>(result.Value);
        var order = page.Items.Select(i => i.Id).ToList();

        var provenIndex = order.IndexOf(proven.Id);
        var unprovenIndex = order.IndexOf(unproven.Id);
        Assert.True(provenIndex >= 0 && unprovenIndex >= 0, "both candidates should be present");
        Assert.True(provenIndex < unprovenIndex,
            "identical oath and identical distance: the both-Proven candidate should outrank the not-both-Proven one");
    }
}
