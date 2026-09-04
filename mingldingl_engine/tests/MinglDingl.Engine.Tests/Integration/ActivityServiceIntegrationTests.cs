using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class ActivityServiceIntegrationTests : IntegrationTestBase
{
    private ActivityService BuildService()
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new LootService(Db, score, NullLogger<LootService>.Instance));
        return new ActivityService(Db, score, quests, milestones, broadcast, config, oaths);
    }

    private ActivityService BuildService(SupabaseBroadcastService broadcast)
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new LootService(Db, score, NullLogger<LootService>.Instance));
        return new ActivityService(Db, score, quests, milestones, broadcast, config, oaths);
    }

    [Fact]
    public async Task ConfirmAsync_FirstOneSidedConfirm_BroadcastsDateConfirmedWithIsCompleteFalse()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = BuildService(broadcast);

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("\"app-nudges\"", handler.LastRequestBody);
        Assert.Contains("\"date_confirmed\"", handler.LastRequestBody);
        Assert.Contains("\"isComplete\":false", handler.LastRequestBody);
        Assert.Contains($"\"userId\":\"{match.InitiatorId}\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task ConfirmAsync_CompletingConfirm_BroadcastsDateConfirmedWithIsCompleteTrue()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = BuildService(broadcast);

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        await service.ConfirmAsync(match, match.ReceiverId, suggestionId);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("\"date_confirmed\"", handler.LastRequestBody);
        Assert.Contains("\"isComplete\":true", handler.LastRequestBody);
    }

    private async Task<(Match match, Guid suggestionId)> SeedMatchWithSuggestionAsync()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);

        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20, FlameRiteCompletedAt = DateTime.UtcNow };
        Db.Matches.Add(match);

        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);

        await Db.SaveChangesAsync();
        return (match, suggestion.Id);
    }

    [Fact]
    public async Task ConfirmAsync_RepeatedConfirmAfterCompletion_DoesNotReAwardDateConfirmedXp()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        await service.ConfirmAsync(match, match.ReceiverId, suggestionId);

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        await service.ConfirmAsync(match, match.ReceiverId, suggestionId);
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var initiatorEvents = Db.ScoreEvents.Where(e => e.UserId == match.InitiatorId && e.EventType == "DateConfirmed").ToList();
        var receiverEvents = Db.ScoreEvents.Where(e => e.UserId == match.ReceiverId && e.EventType == "DateConfirmed").ToList();

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

        var (firstResult, firstAwarded) = await service.ConfirmAsync(match, match.InitiatorId, suggestionId);
        Assert.False(firstResult.Confirmation!.IsComplete);
        Assert.Equal(0, firstAwarded);

        var (secondResult, secondAwarded) = await service.ConfirmAsync(match, match.ReceiverId, suggestionId);
        Assert.True(secondResult.Confirmation!.IsComplete);

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

    [Fact]
    public async Task ConfirmAsync_CompletesQualifyingEncounter_RefreshesOathForBothParticipants()
    {
        var swornInitiator = NewCompleteUser();
        swornInitiator.Oath = "Bond";
        swornInitiator.OathSwornAt = DateTime.UtcNow.AddDays(-5);
        Db.Users.Add(swornInitiator);

        var swornReceiver = NewCompleteUser();
        swornReceiver.Oath = "Fate";
        swornReceiver.OathSwornAt = DateTime.UtcNow.AddDays(-5);
        Db.Users.Add(swornReceiver);
        await Db.SaveChangesAsync();

        var initiatorPriorPartner = NewCompleteUser();
        Db.Users.Add(initiatorPriorPartner);
        var initiatorPriorMatch = new Match { InitiatorId = swornInitiator.Id, ReceiverId = initiatorPriorPartner.Id, Status = "Active" };
        Db.Matches.Add(initiatorPriorMatch);
        var initiatorPriorBusiness = new BusinessPartner { Name = "Prior Cafe (initiator)", Category = "Cafe", City = "Ulaanbaatar" };
        Db.BusinessPartners.Add(initiatorPriorBusiness);
        await Db.SaveChangesAsync();
        var initiatorPriorSuggestion = new ActivitySuggestion
        {
            MatchId = initiatorPriorMatch.Id, BusinessPartnerId = initiatorPriorBusiness.Id,
            ActivityType = "Cafe", Title = "Coffee",
        };
        Db.ActivitySuggestions.Add(initiatorPriorSuggestion);
        await Db.SaveChangesAsync();
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = initiatorPriorMatch.Id, ActivitySuggestionId = initiatorPriorSuggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddDays(-2),
        });
        await Db.SaveChangesAsync();

        var receiverPriorPartner = NewCompleteUser();
        Db.Users.Add(receiverPriorPartner);
        var receiverPriorMatch = new Match { InitiatorId = swornReceiver.Id, ReceiverId = receiverPriorPartner.Id, Status = "Active" };
        Db.Matches.Add(receiverPriorMatch);
        var receiverPriorBusiness = new BusinessPartner { Name = "Prior Cafe (receiver)", Category = "Cafe", City = "Ulaanbaatar" };
        Db.BusinessPartners.Add(receiverPriorBusiness);
        await Db.SaveChangesAsync();
        var receiverPriorSuggestion = new ActivitySuggestion
        {
            MatchId = receiverPriorMatch.Id, BusinessPartnerId = receiverPriorBusiness.Id,
            ActivityType = "Cafe", Title = "Coffee",
        };
        Db.ActivitySuggestions.Add(receiverPriorSuggestion);
        await Db.SaveChangesAsync();
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = receiverPriorMatch.Id, ActivitySuggestionId = receiverPriorSuggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddDays(-2),
        });
        await Db.SaveChangesAsync();

        var match = new Match { InitiatorId = swornInitiator.Id, ReceiverId = swornReceiver.Id, MessageCount = 20, FlameRiteCompletedAt = DateTime.UtcNow };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        await Db.SaveChangesAsync();

        var service = BuildService();
        await service.ConfirmAsync(match, match.InitiatorId, suggestion.Id);
        await service.ConfirmAsync(match, match.ReceiverId, suggestion.Id);

        Db.ChangeTracker.Clear();
        var reloadedInitiator = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == swornInitiator.Id);
        var reloadedReceiver = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == swornReceiver.Id);
        Assert.True(reloadedInitiator.OathProven);
        Assert.True(reloadedReceiver.OathProven);
    }

    [Fact]
    public async Task ConfirmAsync_BothConfirm_SetsCompletedAtOnceOnTheCompletingCall()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Null(afterFirst.CompletedAt);

        await service.ConfirmAsync(match, match.ReceiverId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.NotNull(afterSecond.CompletedAt);
        var completedAt = afterSecond.CompletedAt!.Value;

        await Task.Delay(50);
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterRepeat = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Equal(completedAt, afterRepeat.CompletedAt);
    }

    private async Task<(Match match, DateConfirmation confirmation)> SeedCompletedDateAsync(double hoursAgo)
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var confirmation = new DateConfirmation
        {
            MatchId = match.Id,
            ActivitySuggestionId = suggestionId,
            InitiatorConfirmed = true,
            ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-hoursAgo),
        };
        Db.DateConfirmations.Add(confirmation);
        await Db.SaveChangesAsync();
        return (match, confirmation);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_Before48Hours_NotDue()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 10);
        var service = BuildService();

        var (due, title) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.False(due);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_After48Hours_Due()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        var (due, title) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.True(due);
        Assert.Equal("Coffee Date", title);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_NoCompletedDate_NotDue()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var service = BuildService();
        var (due, _) = await service.GetAttendanceCheckStatusAsync(match.Id, initiator.Id);

        Assert.False(due);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_AlreadyAnsweredByThisUser_NotDue()
    {
        var (match, confirmation) = await SeedCompletedDateAsync(hoursAgo: 49);
        confirmation.InitiatorAttended = true;
        await Db.SaveChangesAsync();

        var service = BuildService();
        var (due, _) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.False(due);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_BothSayYes_NoNoShowFlagIncrementEitherSide()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: true);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(0, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_BothSayNo_NoNoShowFlagIncrementEitherSide()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: false);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(0, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_Mismatch_IncrementsOnlyTheDenyingSidesFlagCount()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(1, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_ReAnswering_IsIdempotentAndReturnsThePreviousAnswer()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        var first = await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        var second = await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: false);

        Assert.Equal(true, first);
        Assert.Equal(true, second);

        Db.ChangeTracker.Clear();
        var confirmation = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.True(confirmation.InitiatorAttended);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_MismatchBelowThreshold_DoesNotDockReputation()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(1.0m, receiver!.ReputationScore);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_SameDenyingUserAcrossThreeDistinctMatches_DocksReputationOnceAtThreshold()
    {
        var denyingUser = NewCompleteUser();
        Db.Users.Add(denyingUser);
        await Db.SaveChangesAsync();
        var service = BuildService();

        for (int i = 0; i < 3; i++)
        {
            var initiator = NewCompleteUser();
            Db.Users.Add(initiator);
            var match = new Match { InitiatorId = initiator.Id, ReceiverId = denyingUser.Id, MessageCount = 20 };
            Db.Matches.Add(match);
            var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = $"Coffee Date {i}" };
            Db.ActivitySuggestions.Add(suggestion);
            var confirmation = new DateConfirmation
            {
                MatchId = match.Id,
                ActivitySuggestionId = suggestion.Id,
                InitiatorConfirmed = true,
                ReceiverConfirmed = true,
                CompletedAt = DateTime.UtcNow.AddHours(-49),
            };
            Db.DateConfirmations.Add(confirmation);
            await Db.SaveChangesAsync();

            await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
            await service.SubmitAttendanceAsync(match.Id, denyingUser.Id, attended: false);
        }

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(denyingUser.Id);
        Assert.Equal(3, reloaded!.NoShowFlagCount);
        Assert.Equal(0.9m, reloaded.ReputationScore);

        var penaltyEvents = Db.ScoreEvents.Where(e => e.UserId == denyingUser.Id && e.EventType == "RepeatedNoShowPenalty").ToList();
        Assert.Single(penaltyEvents);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_TwoMismatchesFromTheSameMatch_OnlyCountsOnceTowardThreshold()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);

        var suggestionA = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestionA);
        var confirmationA = new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = suggestionA.Id, InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = DateTime.UtcNow.AddHours(-50) };
        Db.DateConfirmations.Add(confirmationA);
        await Db.SaveChangesAsync();

        var service = BuildService();
        await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false);

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterFirst!.NoShowFlagCount);

        var suggestionB = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Cinema", Title = "Cinema Date" };
        Db.ActivitySuggestions.Add(suggestionB);
        var confirmationB = new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = suggestionB.Id, InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = DateTime.UtcNow.AddHours(-49) };
        Db.DateConfirmations.Add(confirmationB);
        await Db.SaveChangesAsync();

        await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false);

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterSecond!.NoShowFlagCount);

        var confirmationBReloaded = await Db.DateConfirmations.FirstAsync(c => c.Id == confirmationB.Id);
        Assert.False(confirmationBReloaded.PenaltyApplied);
    }
}
