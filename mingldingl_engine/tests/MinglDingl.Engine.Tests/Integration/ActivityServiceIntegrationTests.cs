using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests.Integration;

public class ActivityServiceIntegrationTests : IntegrationTestBase
{
    private ActivityService BuildService()
    {
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var milestones = new MilestoneService(Db);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object);
        return new ActivityService(Db, score, quests, milestones, broadcast);
    }

    private async Task<(Match match, Guid suggestionId)> SeedMatchWithSuggestionAsync()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);

        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);

        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);

        await Db.SaveChangesAsync();
        return (match, suggestion.Id);
    }

    [Fact]
    public async Task ConfirmAsync_RepeatedConfirmAfterCompletion_DoesNotReAwardDateConfirmedXp()
    {
        // Regression test for D2: ConfirmAsync used to re-enter the
        // `confirmation.IsComplete` branch (and re-fire AwardManyAsync, +50 XP to
        // both users) on every subsequent confirm call after the pair had already
        // completed — an unbounded XP pump via a simple repeat POST. The fix adds
        // a was-complete transition guard so the award only fires once, on the
        // confirmation that flips IsComplete false -> true.
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        await service.ConfirmAsync(match, match.ReceiverId, suggestionId); // completes here, awards once

        // Repeat confirms from either participant after completion must be no-ops for score.
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        await service.ConfirmAsync(match, match.ReceiverId, suggestionId);
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var initiatorEvents = Db.ScoreEvents.Where(e => e.UserId == match.InitiatorId && e.EventType == "DateConfirmed").ToList();
        var receiverEvents = Db.ScoreEvents.Where(e => e.UserId == match.ReceiverId && e.EventType == "DateConfirmed").ToList();
        // Exactly one DateConfirmed award per user, worth exactly 50 XP each — the
        // five ConfirmAsync calls above (three of them repeats after completion)
        // must never produce a second DateConfirmed ScoreEvent. Deliberately not
        // asserting on the users' absolute TotalScore: "pledge" is one of the
        // rotating daily quests, so IncrementAsync may independently award
        // QuestComplete XP for the same action on whichever day the suite runs —
        // that's unrelated to D2 and would make this assertion flaky.
        Assert.Single(initiatorEvents);
        Assert.Single(receiverEvents);
        Assert.Equal(50, initiatorEvents[0].Delta);
        Assert.Equal(50, receiverEvents[0].Delta);
    }

    [Fact]
    public async Task ConfirmAsync_FirstCompletingConfirm_AwardsDateConfirmedXpOnce()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        var (afterFirst, firstAwarded) = await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        Assert.False(afterFirst!.IsComplete);
        Assert.Equal(0, firstAwarded); // not complete yet — nothing awarded

        var (afterSecond, secondAwarded) = await service.ConfirmAsync(match, match.ReceiverId, suggestionId);
        Assert.True(afterSecond!.IsComplete);
        // 50 (DateConfirmed) plus whatever "pledge" independently awards via
        // the daily quest rotation on whichever date this runs.
        int questBonus = Db.ScoreEvents
            .Where(e => e.UserId == match.ReceiverId && e.EventType == "QuestComplete")
            .Sum(e => e.Delta);
        Assert.Equal(50 + questBonus, secondAwarded);

        Db.ChangeTracker.Clear();
        var initiatorEvents = Db.ScoreEvents.Where(e => e.UserId == match.InitiatorId && e.EventType == "DateConfirmed").ToList();
        var receiverEvents = Db.ScoreEvents.Where(e => e.UserId == match.ReceiverId && e.EventType == "DateConfirmed").ToList();
        Assert.Single(initiatorEvents);
        Assert.Single(receiverEvents);
        Assert.Equal(50, initiatorEvents[0].Delta);
        Assert.Equal(50, receiverEvents[0].Delta);
    }
}
