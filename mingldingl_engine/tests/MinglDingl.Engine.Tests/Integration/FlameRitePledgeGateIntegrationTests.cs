using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class FlameRitePledgeGateIntegrationTests : IntegrationTestBase
{
    private ActivityService BuildActivityService(ConfigService config)
    {
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new LootService(Db, score, NullLogger<LootService>.Instance));
        return new ActivityService(Db, score, quests, milestones, broadcast, config, oaths, BuildTestPush());
    }

    private async Task<(Match Match, ActivitySuggestion Suggestion, Guid AId, Guid BId)> SeedPledgeableMatchAsync(bool riteComplete)
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);

        var match = new Match
        {
            InitiatorId = a.Id,
            ReceiverId = b.Id,
            Status = "Active",
            MessageCount = 20,
            IcebreakerComplete = true,
            FlameRiteCompletedAt = riteComplete ? DateTime.UtcNow : null,
        };
        Db.Matches.Add(match);

        var business = new BusinessPartner { Name = "Test Cafe", Category = "Cafe", City = "Ulaanbaatar", IsVerified = true };
        Db.BusinessPartners.Add(business);
        await Db.SaveChangesAsync();

        var suggestion = new ActivitySuggestion
        {
            MatchId = match.Id,
            BusinessPartnerId = business.Id,
            ActivityType = "Cafe",
            Title = "Coffee Date",
            BusinessPartner = business,
        };
        Db.ActivitySuggestions.Add(suggestion);
        await Db.SaveChangesAsync();

        return (match, suggestion, a.Id, b.Id);
    }

    [Fact]
    public async Task Confirm_WithoutTheRite_IsRejected()
    {
        var (match, suggestion, aId, _) = await SeedPledgeableMatchAsync(riteComplete: false);
        var service = BuildActivityService(new ConfigService());

        var (result, awarded) = await service.ConfirmAsync(match, aId, suggestion.Id);

        Assert.Equal(ConfirmRejection.FlameRiteIncomplete, result.Rejection);
        Assert.Equal(0, awarded);
        Assert.False(await Db.DateConfirmations.AnyAsync(c => c.MatchId == match.Id));
    }

    [Fact]
    public async Task Confirm_WithoutTheRite_WhileVideoDisabled_Succeeds()
    {
        // With no video there can be no rite; requiring it would deadlock every pledge.
        var (match, suggestion, aId, _) = await SeedPledgeableMatchAsync(riteComplete: false);
        var config = new ConfigService();
        config.Set("dating.flamerite.required", "true");
        config.Set("video.enabled", "false");
        var service = BuildActivityService(config);

        var (result, _) = await service.ConfirmAsync(match, aId, suggestion.Id);

        Assert.Null(result.Rejection);
        Assert.True(await Db.DateConfirmations.AnyAsync(c => c.MatchId == match.Id));
    }

    [Fact]
    public async Task Confirm_AfterTheRite_Succeeds()
    {
        var (match, suggestion, aId, _) = await SeedPledgeableMatchAsync(riteComplete: true);
        var service = BuildActivityService(new ConfigService());

        var (result, _) = await service.ConfirmAsync(match, aId, suggestion.Id);

        Assert.Null(result.Rejection);
        Assert.True(await Db.DateConfirmations.AnyAsync(c => c.MatchId == match.Id));
    }

    [Fact]
    public async Task Confirm_WithTheRiteDisabled_SucceedsWithoutIt()
    {
        var (match, suggestion, aId, _) = await SeedPledgeableMatchAsync(riteComplete: false);
        var config = new ConfigService();
        config.Set("dating.flamerite.required", "false");

        var (result, _) = await BuildActivityService(config).ConfirmAsync(match, aId, suggestion.Id);

        Assert.Null(result.Rejection);
        Assert.True(await Db.DateConfirmations.AnyAsync(c => c.MatchId == match.Id));
    }

    [Fact]
    public async Task Confirm_OnABackfilledMatch_Succeeds()
    {
        var (match, suggestion, aId, _) = await SeedPledgeableMatchAsync(riteComplete: true);
        match.FlameRiteProposedById = null;
        match.FlameRiteProposedAt = null;
        match.FlameRiteAcceptedAt = null;
        await Db.SaveChangesAsync();

        var (result, _) = await BuildActivityService(new ConfigService()).ConfirmAsync(match, aId, suggestion.Id);

        Assert.Null(result.Rejection);
    }
}
