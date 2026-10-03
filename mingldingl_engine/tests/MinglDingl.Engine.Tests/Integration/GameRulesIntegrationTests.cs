using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>The party limit, scars, waypoints, festival seasons, weekly trials and retiring together.</summary>
public class GameRulesIntegrationTests : IntegrationTestBase
{
    private (MatchesController Controller, ConfigService Config) BuildMatches(Guid userId, ConfigService? config = null)
    {
        config ??= new ConfigService();
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
        var controller = new MatchesController(Db, score, ghosting, quests, milestones, BuildTestPush(), config, BuildTestBroadcast(), BuildTestStorage(),
            BuildParty(config), BuildTrials(config, score), BuildRetire(config))
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return (controller, config);
    }

    private ActivityService BuildActivities(ConfigService config)
    {
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var honours = new HonourService(Db, NullLogger<HonourService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, honours);
        return new ActivityService(Db, score, quests, milestones, BuildTestBroadcast(), config, oaths, BuildTestPush(), honours, BuildKeptEncounters(config, score));
    }

    private async Task<(User A, User B, Match Match)> SeedPairAsync(string status = "Active")
    {
        var a = NewCompleteUser(Guid.NewGuid(), "Male");
        var b = NewCompleteUser(Guid.NewGuid(), "Female");
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = a.Id, ReceiverId = b.Id, Status = status, RevealLevel = 1 };
        Db.Users.AddRange(a, b);
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return (a, b, match);
    }

    private async Task<User> SeedFullUserAsync(string gender, int seats)
    {
        var user = NewCompleteUser(Guid.NewGuid(), gender);
        Db.Users.Add(user);
        for (int i = 0; i < seats; i++)
        {
            var other = NewCompleteUser(Guid.NewGuid(), gender == "Male" ? "Female" : "Male");
            Db.Users.Add(other);
            Db.Matches.Add(new Match { Id = Guid.NewGuid(), InitiatorId = user.Id, ReceiverId = other.Id, Status = "Active" });
        }
        await Db.SaveChangesAsync();
        return user;
    }

    /// <summary>A completed pledge at a venue in <paramref name="district"/>, answered by neither side yet.</summary>
    private async Task<DateConfirmation> SeedPledgeAsync(Match match, string district, DateTime? completedAt = null)
    {
        var venue = new BusinessPartner { Id = Guid.NewGuid(), Name = $"Venue {district}", Category = "Cafe", City = "Ulaanbaatar", District = district, IsVerified = true };
        var suggestion = new ActivitySuggestion { Id = Guid.NewGuid(), MatchId = match.Id, BusinessPartnerId = venue.Id, ActivityType = "Cafe", Title = "Cafe" };
        var confirmation = new DateConfirmation
        {
            Id = Guid.NewGuid(), MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CreatedAt = completedAt ?? DateTime.UtcNow, CompletedAt = completedAt ?? DateTime.UtcNow,
        };
        Db.BusinessPartners.Add(venue);
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(confirmation);
        await Db.SaveChangesAsync();
        return confirmation;
    }

    /// <summary>Keeps the pair's latest pledge: both say the other came.</summary>
    private async Task KeepAsync(ActivityService activities, Match match)
    {
        await activities.SubmitAttendanceAsync(match.Id, match.InitiatorId, true);
        await activities.SubmitAttendanceAsync(match.Id, match.ReceiverId, true);
    }

    private Task<User> ReloadAsync(Guid id)
    {
        Db.ChangeTracker.Clear();
        return Db.Users.AsNoTracking().SingleAsync(u => u.Id == id);
    }

    private Task<bool> HoldsAsync(Guid userId, string honourId) =>
        Db.UserItems.AnyAsync(i => i.UserId == userId && i.ItemId == honourId);

    // ---------- the party ----------

    [Fact]
    public async Task RequestMatch_EverySeatTaken_IsRefusedAndSpendsNoBudget()
    {
        var me = await SeedFullUserAsync("Male", 4);
        var target = NewCompleteUser(Guid.NewGuid(), "Female");
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        var result = Assert.IsAssignableFrom<ObjectResult>(await BuildMatches(me.Id).Controller.RequestMatch(new RequestMatchDto(target.Id)));

        Assert.Equal(StatusCodes.Status409Conflict, result.StatusCode);
        Assert.Contains("party.full", System.Text.Json.JsonSerializer.Serialize(result.Value));
        Assert.Equal(0, (await ReloadAsync(me.Id)).DailyMatchesUsed);
    }

    [Fact]
    public async Task RequestMatch_TargetsEverySeatTaken_IsRefused()
    {
        var target = await SeedFullUserAsync("Female", 4);
        var me = NewCompleteUser(Guid.NewGuid(), "Male");
        Db.Users.Add(me);
        await Db.SaveChangesAsync();

        var result = Assert.IsAssignableFrom<ObjectResult>(await BuildMatches(me.Id).Controller.RequestMatch(new RequestMatchDto(target.Id)));

        Assert.Equal(StatusCodes.Status409Conflict, result.StatusCode);
        Assert.Contains("party.target_full", System.Text.Json.JsonSerializer.Serialize(result.Value));
    }

    [Fact]
    public async Task RequestMatch_HigherTier_HasMoreSeats()
    {
        var me = await SeedFullUserAsync("Male", 4);
        me.GemTier = "Opal";
        await Db.SaveChangesAsync();
        var target = NewCompleteUser(Guid.NewGuid(), "Female");
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        Assert.IsType<OkObjectResult>(await BuildMatches(me.Id).Controller.RequestMatch(new RequestMatchDto(target.Id)));
    }

    [Fact]
    public async Task RequestMatch_PartyDisabled_IgnoresSeats()
    {
        var config = new ConfigService();
        config.Set("party.enabled", "false");
        var me = await SeedFullUserAsync("Male", 4);
        var target = NewCompleteUser(Guid.NewGuid(), "Female");
        Db.Users.Add(target);
        await Db.SaveChangesAsync();

        Assert.IsType<OkObjectResult>(await BuildMatches(me.Id, config).Controller.RequestMatch(new RequestMatchDto(target.Id)));
    }

    [Fact]
    public async Task GetCandidates_SomeoneWithNoFreeSeat_IsNotOffered()
    {
        var full = await SeedFullUserAsync("Female", 4);
        var open = NewCompleteUser(Guid.NewGuid(), "Female");
        var me = NewCompleteUser(Guid.NewGuid(), "Male");
        Db.Users.AddRange(open, me);
        await Db.SaveChangesAsync();

        var page = Assert.IsType<PagedResponse<CandidateResponse>>(
            Assert.IsType<OkObjectResult>(await BuildMatches(me.Id).Controller.GetCandidates(pageSize: 100)).Value);

        Assert.DoesNotContain(page.Items, c => c.Id == full.Id);
    }

    // ---------- scars ----------

    [Fact]
    public async Task GhostPenalty_OpensAScar()
    {
        var (a, _, _) = await SeedPairAsync();
        await new ScoreService(Db, new ConfigService()).AwardAsync(a.Id, "GhostPenalty");

        Assert.Equal(1, (await ReloadAsync(a.Id)).OpenScars);
    }

    [Fact]
    public async Task KeptEncounters_CloseAScar_RestoreReputation_AndEarnMended()
    {
        var config = new ConfigService();
        var (a, b, match) = await SeedPairAsync();
        await new ScoreService(Db, config).AwardAsync(a.Id, "GhostPenalty");
        decimal docked = (await ReloadAsync(a.Id)).ReputationScore;
        var activities = BuildActivities(config);

        await SeedPledgeAsync(match, "Sukhbaatar", DateTime.UtcNow.AddDays(-3));
        await KeepAsync(activities, match);
        var halfway = await ReloadAsync(a.Id);
        Assert.Equal((1, 1), (halfway.OpenScars, halfway.ScarHealProgress));

        await SeedPledgeAsync(match, "Sukhbaatar", DateTime.UtcNow.AddDays(-2));
        await KeepAsync(activities, match);
        var healed = await ReloadAsync(a.Id);

        Assert.Equal((0, 0), (healed.OpenScars, healed.ScarHealProgress));
        Assert.Equal(docked + 0.1m, healed.ReputationScore);
        Assert.True(await HoldsAsync(a.Id, "title_mended"));
        Assert.False(await HoldsAsync(b.Id, "title_mended")); // b was never scarred
        Assert.True(await Db.ScoreEvents.AnyAsync(e => e.UserId == a.Id && e.EventType == "ScarHealed"));
    }

    [Fact]
    public async Task ANoShow_DoesNotHealAScar()
    {
        var config = new ConfigService();
        config.Set("scars.heal.encounters", "1");
        var (a, _, match) = await SeedPairAsync();
        await new ScoreService(Db, config).AwardAsync(a.Id, "GhostPenalty");
        var activities = BuildActivities(config);

        await SeedPledgeAsync(match, "Sukhbaatar", DateTime.UtcNow.AddDays(-3));
        await activities.SubmitAttendanceAsync(match.Id, match.InitiatorId, true);
        await activities.SubmitAttendanceAsync(match.Id, match.ReceiverId, false);

        Assert.Equal(1, (await ReloadAsync(a.Id)).OpenScars);
    }

    // ---------- waypoints and seasons ----------

    [Fact]
    public async Task KeptEncounters_InThreeDistricts_EarnCartographer()
    {
        var config = new ConfigService();
        var activities = BuildActivities(config);
        var (a, b, match) = await SeedPairAsync();
        var kept = BuildKeptEncounters(config, new ScoreService(Db, config));

        foreach (var (district, daysAgo) in new[] { ("Khan-Uul", 9), ("Bayanzurkh", 8), ("Bayanzurkh", 7) })
        {
            await SeedPledgeAsync(match, district, DateTime.UtcNow.AddDays(-daysAgo));
            await KeepAsync(activities, match);
        }
        Assert.Equal(2, await kept.DistrictsChartedAsync(a.Id));
        Assert.False(await HoldsAsync(a.Id, "title_cartographer"));

        await SeedPledgeAsync(match, "Chingeltei", DateTime.UtcNow.AddDays(-6));
        await KeepAsync(activities, match);

        Assert.Equal(3, await kept.DistrictsChartedAsync(a.Id));
        Assert.True(await HoldsAsync(a.Id, "title_cartographer"));
        Assert.True(await HoldsAsync(b.Id, "title_cartographer"));
    }

    [Fact]
    public async Task AnEncounterSwornDuringNaadam_EarnsTheNaadamHonour_WhenKeptLater()
    {
        var config = new ConfigService();
        var activities = BuildActivities(config);
        var (a, _, match) = await SeedPairAsync();

        await SeedPledgeAsync(match, "Sukhbaatar", new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc));
        await KeepAsync(activities, match);

        Assert.True(await HoldsAsync(a.Id, "title_naadam"));
        Assert.False(await HoldsAsync(a.Id, "title_whitemoon"));
    }

    [Fact]
    public void Season_WhiteMoonFollowsTheCalendar_AndAnAdminCanAddAYear()
    {
        var config = new ConfigService();
        var seasons = new SeasonService(config);
        Assert.Equal("whitemoon", seasons.At(new DateTime(2027, 2, 7, 12, 0, 0, DateTimeKind.Utc))?.Id);
        Assert.Null(seasons.At(new DateTime(2027, 2, 9, 0, 0, 0, DateTimeKind.Utc)));

        var later = new DateTime(2031, 1, 24, 12, 0, 0, DateTimeKind.Utc);
        Assert.Null(seasons.At(later));
        config.Set("season.whitemoon.start_yyyymmdd", "20310123");
        config.Set("season.whitemoon.end_yyyymmdd", "20310125");
        Assert.Equal("whitemoon", seasons.At(later)?.Id);

        config.Set("season.enabled", "false");
        Assert.Null(seasons.At(later));
    }

    [Fact]
    public void Season_NaadamIsInclusiveOfBothEnds()
    {
        var seasons = new SeasonService(new ConfigService());
        Assert.Null(seasons.At(new DateTime(2026, 7, 10, 23, 59, 0, DateTimeKind.Utc)));
        Assert.Equal("naadam", seasons.At(new DateTime(2026, 7, 11, 0, 0, 0, DateTimeKind.Utc))?.Id);
        Assert.Equal("naadam", seasons.At(new DateTime(2026, 7, 13, 23, 59, 0, DateTimeKind.Utc))?.Id);
        Assert.Null(seasons.At(new DateTime(2026, 7, 14, 0, 0, 0, DateTimeKind.Utc)));
    }

    // ---------- weekly trials ----------

    [Fact]
    public void WeekStart_IsMondayUtc()
    {
        Assert.Equal(new DateTime(2026, 9, 28), BondTrialService.WeekStartOf(new DateTime(2026, 10, 3, 4, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateTime(2026, 9, 28), BondTrialService.WeekStartOf(new DateTime(2026, 9, 28, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateTime(2026, 9, 28), BondTrialService.WeekStartOf(new DateTime(2026, 10, 4, 23, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public async Task ExchangeTrial_NeedsBothSides_AndPaysBothOnce()
    {
        var config = new ConfigService();
        config.Set("video.enabled", "false"); // no rite: always the exchange trial
        var (a, b, match) = await SeedPairAsync();
        for (int i = 0; i < 5; i++) Db.Messages.Add(new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = a.Id, Content = "hi" });
        await Db.SaveChangesAsync();

        var (asA, _) = BuildMatches(a.Id, config);
        var trial = Assert.IsType<BondTrialResponse>(Assert.IsType<OkObjectResult>(await asA.GetTrial(match.Id)).Value);
        Assert.Equal(("exchange", 5, 0, false), (trial.Kind, trial.MyProgress, trial.TheirProgress, trial.Complete));
        var refused = await Assert.ThrowsAsync<DomainException>(() => asA.ClaimTrial(match.Id));
        Assert.Equal("trial.incomplete", refused.Code);

        for (int i = 0; i < 5; i++) Db.Messages.Add(new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = b.Id, Content = "hi" });
        await Db.SaveChangesAsync();

        var (asB, _) = BuildMatches(b.Id, config);
        var claimed = Assert.IsType<BondTrialResponse>(Assert.IsType<OkObjectResult>(await asB.ClaimTrial(match.Id)).Value);
        Assert.True(claimed.Claimed);
        var again = await Assert.ThrowsAsync<DomainException>(() => asA.ClaimTrial(match.Id));
        Assert.Equal("trial.already_claimed", again.Code);

        Assert.Equal(1, await Db.ScoreEvents.CountAsync(e => e.UserId == a.Id && e.EventType == "BondTrialDone"));
        Assert.Equal(1, await Db.ScoreEvents.CountAsync(e => e.UserId == b.Id && e.EventType == "BondTrialDone"));
        Assert.Equal(25, (await ReloadAsync(a.Id)).TotalScore);
    }

    [Fact]
    public void TrialKind_IsRiteOnlyWhileTheRiteIsStillOpen()
    {
        var weekStart = new DateTime(2026, 9, 28, 0, 0, 0, DateTimeKind.Utc);
        var done = new Match { Id = Guid.NewGuid(), FlameRiteCompletedAt = weekStart.AddDays(-1) };
        Assert.Equal("exchange", BondTrialService.KindFor(done, weekStart, videoEnabled: true));

        // Across many matches an open rite lands on both kinds, and never on "rite" without video.
        var kinds = Enumerable.Range(0, 40).Select(_ => new Match { Id = Guid.NewGuid() })
            .Select(m => (On: BondTrialService.KindFor(m, weekStart, true), Off: BondTrialService.KindFor(m, weekStart, false)))
            .ToList();
        Assert.Contains(kinds, k => k.On == "rite");
        Assert.Contains(kinds, k => k.On == "exchange");
        Assert.All(kinds, k => Assert.Equal("exchange", k.Off));
    }

    // ---------- retiring ----------

    [Fact]
    public async Task Retire_WithoutACompletedEncounter_IsRefused()
    {
        var (a, _, match) = await SeedPairAsync();
        var refused = await Assert.ThrowsAsync<DomainException>(() => BuildMatches(a.Id).Controller.Retire(match.Id));
        Assert.Equal("retire.no_encounter", refused.Code);
    }

    [Fact]
    public async Task Retire_ProposedThenAccepted_CompletesPausesAndHonoursBoth()
    {
        var (a, b, match) = await SeedPairAsync();
        await SeedPledgeAsync(match, "Sukhbaatar");

        var proposed = Assert.IsType<RetireResponse>(Assert.IsType<OkObjectResult>(await BuildMatches(a.Id).Controller.Retire(match.Id)).Value);
        Assert.Equal("Proposed", proposed.Outcome);
        // A repeat tap by the proposer is not an acceptance.
        var repeat = Assert.IsType<RetireResponse>(Assert.IsType<OkObjectResult>(await BuildMatches(a.Id).Controller.Retire(match.Id)).Value);
        Assert.Equal("Proposed", repeat.Outcome);

        var accepted = Assert.IsType<RetireResponse>(Assert.IsType<OkObjectResult>(await BuildMatches(b.Id).Controller.Retire(match.Id)).Value);
        Assert.Equal("Retired", accepted.Outcome);

        Db.ChangeTracker.Clear();
        Assert.Equal("Completed", (await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id)).Status);
        foreach (var id in new[] { a.Id, b.Id })
        {
            var user = await ReloadAsync(id);
            Assert.True(user.IsPaused);
            Assert.NotNull(user.RetiredAt);
            Assert.True(await HoldsAsync(id, "title_hearthbound"));
        }
    }

    [Fact]
    public async Task Retire_Withdrawn_ClearsTheProposal()
    {
        var (a, b, match) = await SeedPairAsync();
        await SeedPledgeAsync(match, "Sukhbaatar");
        await BuildMatches(a.Id).Controller.Retire(match.Id);

        await BuildMatches(b.Id).Controller.WithdrawRetire(match.Id);

        Db.ChangeTracker.Clear();
        var after = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Null(after.RetireProposedById);
        Assert.Equal("Active", after.Status);
    }
}
