using Microsoft.EntityFrameworkCore;
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
        return new ActivityService(Db, score, quests, milestones, broadcast, new ConfigService());
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

    [Fact]
    public async Task ConfirmAsync_BothConfirm_SetsCompletedAtOnceOnTheCompletingCall()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Null(afterFirst.CompletedAt);

        await service.ConfirmAsync(match, match.ReceiverId, suggestionId); // completes here

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.NotNull(afterSecond.CompletedAt);
        var completedAt = afterSecond.CompletedAt!.Value;

        // A repeat confirm after completion must not move CompletedAt forward.
        await Task.Delay(50);
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterRepeat = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Equal(completedAt, afterRepeat.CompletedAt);
    }

    // Seeds a match with a suggestion whose DateConfirmation is already
    // IsComplete, with CompletedAt backdated by `hoursAgo` — lets tests put
    // the attendance check inside or outside its 48h eligibility window
    // without waiting real time.
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
        Assert.Equal("Coffee Date", title); // SeedMatchWithSuggestionAsync's suggestion Title
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
        var second = await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: false); // attempted flip

        Assert.Equal(true, first);
        Assert.Equal(true, second); // still the original answer — the flip was ignored

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
        Assert.Equal(1.0m, receiver!.ReputationScore); // default NewCompleteUser reputation, untouched below threshold 3
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
        Assert.Equal(0.9m, reloaded.ReputationScore); // docked exactly once, at the 3rd (threshold) mismatch

        var penaltyEvents = Db.ScoreEvents.Where(e => e.UserId == denyingUser.Id && e.EventType == "RepeatedNoShowPenalty").ToList();
        Assert.Single(penaltyEvents);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_TwoMismatchesFromTheSameMatch_OnlyCountsOnceTowardThreshold()
    {
        // A single match can accumulate two completed DateConfirmations (two
        // different confirmed suggestions, confirmed at different times) —
        // PenaltyApplied must prevent a second mismatch on the same match
        // from incrementing NoShowFlagCount a second time, per the "distinct
        // matches only" anti-abuse guarantee. LoadLatestCompletedConfirmationAsync
        // always resolves to the newest completed row, so this drives BOTH
        // mismatches through the real SubmitAttendanceAsync path in the same
        // order a real user would hit them: confirmationA (older) is fully
        // answered first, then confirmationB (newer) becomes the one the
        // matchId-scoped endpoint resolves to.
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
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false); // mismatch #1 — increments once

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterFirst!.NoShowFlagCount);

        // A second confirmed suggestion for the same match, completed more
        // recently — LoadLatestCompletedConfirmationAsync now resolves to
        // this one instead of confirmationA.
        var suggestionB = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Cinema", Title = "Cinema Date" };
        Db.ActivitySuggestions.Add(suggestionB);
        var confirmationB = new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = suggestionB.Id, InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = DateTime.UtcNow.AddHours(-49) };
        Db.DateConfirmations.Add(confirmationB);
        await Db.SaveChangesAsync();

        await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false); // mismatch #2 on the SAME match — must not increment again

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterSecond!.NoShowFlagCount); // still 1, not 2

        var confirmationBReloaded = await Db.DateConfirmations.FirstAsync(c => c.Id == confirmationB.Id);
        Assert.False(confirmationBReloaded.PenaltyApplied); // its own mismatch was recorded but never separately penalized
    }
}
