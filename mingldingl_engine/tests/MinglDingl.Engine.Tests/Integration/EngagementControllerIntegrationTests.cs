using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests.Integration;

public class EngagementControllerIntegrationTests : IntegrationTestBase
{
    private EngagementController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var loot = new LootService(Db, score);
        var milestones = new MilestoneService(Db);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object);
        var controller = new EngagementController(Db, new EngagementService(Db, score), score, quests, loot, milestones, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task RespondQuiz_SubmittedTwiceWithSameAnswers_DoesNotDuplicateRowOrDoubleAwardScore()
    {
        // Regression test: RespondQuiz used to have no duplicate guard, so
        // resubmitting (which the frontend does to poll for the partner's
        // compatibility result) created a new row and re-awarded QuizDone
        // every time — an unbounded score-farming exploit. Both QuizDone and
        // any "quiz" daily-quest bonus (q_quiz, target 1 — only one of
        // today's 3 rotated quests, see QuestService.QuestsForDate) are
        // one-shot per this test's single isFirstResponse pass, so a
        // *second* submission still shouldn't move total score at all,
        // which is what this test actually guards against.
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);

        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Test Quiz" });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var answers = new Dictionary<Guid, string> { [Guid.NewGuid()] = "A" };
        var req = new QuizRespondDto(answers, null);

        await controller.RespondQuiz(quizId, req);
        await controller.RespondQuiz(quizId, req);

        Db.ChangeTracker.Clear();
        var responses = Db.QuizResponses.Where(r => r.QuizId == quizId && r.UserId == userId).ToList();
        Assert.Single(responses);

        var scoreEvents = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "QuizDone").ToList();
        Assert.Single(scoreEvents);

        // "quiz" is only in today's rotated quests on some days — assert
        // the resubmit didn't double-award it, not that it was awarded at
        // all, so this doesn't flake depending on which date the suite runs.
        var questEvents = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "QuestComplete").ToList();
        Assert.True(questEvents.Count <= 1, "QuestComplete must never be awarded more than once for two identical submissions");

        var reloadedUser = await Db.Users.FindAsync(userId);
        int expectedScore = 15 + questEvents.Sum(e => e.Delta); // QuizDone, plus the quest bonus only if today's rotation included it
        Assert.Equal(expectedScore, reloadedUser!.TotalScore);
    }

    [Fact]
    public async Task RespondIcebreaker_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        // Security regression: RespondIcebreaker loaded the match but never checked
        // IsParticipant, unlike RevealIcebreaker in the same controller — a stranger
        // who knew the matchId could inject an icebreaker response into someone
        // else's match, corrupting BothRespondedAsync's completion count and
        // misattributing the reward via Match.OtherParticipant.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        var strangerId = Guid.NewGuid();
        var stranger = NewCompleteUser(strangerId);
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);
        var req = new IcebreakerRespondDto(icebreaker.Id, "Sneaky answer");

        var result = Assert.IsType<ObjectResult>(await controller.RespondIcebreaker(match.Id, req));
        Assert.Equal(403, result.StatusCode);

        Db.ChangeTracker.Clear();
        Assert.Empty(Db.IcebreakerResponses.Where(r => r.MatchId == match.Id));
    }

    [Fact]
    public async Task RespondQuiz_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        // Security regression: RespondQuiz never verified the caller is a
        // participant of req.MatchId before persisting a response and computing
        // compatibility — a stranger could inject a quiz response into someone
        // else's match.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Test Quiz" });
        await Db.SaveChangesAsync();

        var strangerId = Guid.NewGuid();
        var stranger = NewCompleteUser(strangerId);
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);
        var answers = new Dictionary<Guid, string> { [Guid.NewGuid()] = "A" };
        var req = new QuizRespondDto(answers, match.Id);

        var result = Assert.IsType<ObjectResult>(await controller.RespondQuiz(quizId, req));
        Assert.Equal(403, result.StatusCode);

        Db.ChangeTracker.Clear();
        Assert.Empty(Db.QuizResponses.Where(r => r.MatchId == match.Id));
    }

    [Fact]
    public async Task GetQuizStatus_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        // Security regression: GetQuizStatus never verified the caller is a
        // participant of the matchId query param — a stranger who knew the
        // matchId could read compatibility/status info tied to someone else's
        // match responses.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Test Quiz" });
        await Db.SaveChangesAsync();

        var strangerId = Guid.NewGuid();
        var stranger = NewCompleteUser(strangerId);
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);

        var result = Assert.IsType<ObjectResult>(await controller.GetQuizStatus(quizId, match.Id));
        Assert.Equal(403, result.StatusCode);
    }

    [Fact]
    public async Task OpenMilestone_CalledTwiceForSameMilestone_OnlyFirstCallAwardsXp()
    {
        // Regression test for the OpenMilestone race fix: the endpoint used to load
        // the row, check OpenedAt in memory, then rely on AwardWithDeltaAsync's
        // internal SaveChanges to persist OpenedAt (A2/B.1 in the final review) —
        // two concurrent calls could both observe OpenedAt == null and both award.
        // The fix makes the claim an atomic conditional UPDATE (ExecuteUpdateAsync
        // ... WHERE OpenedAt IS NULL); this exercises that real UPDATE against
        // Postgres and confirms only the first caller gets rowsAffected == 1.
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);
        Db.UserMilestones.Add(new UserMilestone { UserId = userId, MilestoneId = "first_match" });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var first = Assert.IsType<OkObjectResult>(await controller.OpenMilestone("first_match"));
        var firstBody = Assert.IsType<OpenMilestoneResponse>(first.Value);
        Assert.False(firstBody.AlreadyOpened);
        Assert.Equal(25, firstBody.Awarded); // first_match Xp

        var second = Assert.IsType<OkObjectResult>(await controller.OpenMilestone("first_match"));
        var secondBody = Assert.IsType<OpenMilestoneResponse>(second.Value);
        Assert.True(secondBody.AlreadyOpened);
        Assert.Equal(0, secondBody.Awarded);

        Db.ChangeTracker.Clear();
        var events = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "MilestoneChest").ToList();
        Assert.Single(events);

        var reloadedUser = await Db.Users.FindAsync(userId);
        Assert.Equal(25, reloadedUser!.TotalScore);
    }

    [Fact]
    public async Task ClaimQuestChest_CalledTwiceAfterAllQuestsComplete_OnlyFirstCallAwardsXp()
    {
        // Regression/coverage: confirms the existing check-then-award idempotency
        // path still returns the already-claimed response (not a 500) after the
        // D2/race fix-wave changes wrapped the award in a try/catch for
        // ix_score_events_once_per_day. The genuine cross-transaction TOCTOU race
        // (AnyAsync sees false, then the INSERT conflicts) needs two overlapping
        // live transactions to reproduce and isn't exercisable in this rollback-
        // per-test harness; ScoreServiceIntegrationTests below proves the partial
        // unique index + DbUpdateException classifier that actually close that
        // window work against real Postgres.
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);

        var today = DateTime.UtcNow.Date;
        foreach (var d in QuestService.QuestsForDate(today))
            Db.UserDailyQuests.Add(new UserDailyQuest
            {
                UserId = userId,
                QuestDate = today,
                QuestId = d.Id,
                Progress = d.Target,
                CompletedAt = DateTime.UtcNow,
            });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var first = Assert.IsType<OkObjectResult>(await controller.ClaimQuestChest());
        var firstBody = Assert.IsType<ClaimChestResponse>(first.Value);
        Assert.False(firstBody.AlreadyClaimed);
        Assert.Equal(30, firstBody.Awarded);

        var second = Assert.IsType<OkObjectResult>(await controller.ClaimQuestChest());
        var secondBody = Assert.IsType<ClaimChestResponse>(second.Value);
        Assert.True(secondBody.AlreadyClaimed);
        Assert.Equal(0, secondBody.Awarded);

        Db.ChangeTracker.Clear();
        var events = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "QuestChest").ToList();
        Assert.Single(events);
    }

    [Fact]
    public async Task RevealIcebreaker_DifferentIcebreakerIdOnAnAlreadyCompletedMatch_ReturnsBadRequestNotEmptyList()
    {
        // Regression test: GetIcebreaker picks a new random Icebreaker on every
        // call (no persistence of "the" icebreaker for a match), and
        // Match.IcebreakerComplete is a one-shot flag that never resets once a
        // match has EVER completed any icebreaker. RevealIcebreaker used to gate
        // on that match-level flag instead of checking responses for the
        // specific icebreakerId requested -- so re-opening the icebreaker screen
        // after already completing one (a routine "let me look at that answer
        // again" revisit) fetched a brand-new, unanswered icebreakerId and got
        // 200 + [] back instead of 400, which the app read as "revealed" with
        // undefined answers (literal "[missing \"%{answer}\" value]" shown to
        // the user).
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active", IcebreakerComplete = true };
        Db.Matches.Add(match);

        var freshIcebreaker = new Icebreaker { QuestionText = "A different question?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(freshIcebreaker);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);

        var result = Assert.IsType<BadRequestObjectResult>(await controller.RevealIcebreaker(match.Id, freshIcebreaker.Id));
        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public async Task RevealIcebreaker_BothResponded_ReturnsBothAnswersRegardlessOfMatchFlag()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        Db.IcebreakerResponses.Add(new IcebreakerResponse { MatchId = match.Id, IcebreakerId = icebreaker.Id, UserId = initiator.Id, Answer = "Mine" });
        Db.IcebreakerResponses.Add(new IcebreakerResponse { MatchId = match.Id, IcebreakerId = icebreaker.Id, UserId = receiver.Id, Answer = "Theirs" });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);

        var result = Assert.IsType<OkObjectResult>(await controller.RevealIcebreaker(match.Id, icebreaker.Id));
        var entries = Assert.IsType<List<IcebreakerRevealEntry>>(result.Value);
        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, e => e.UserId == initiator.Id && e.Answer == "Mine");
        Assert.Contains(entries, e => e.UserId == receiver.Id && e.Answer == "Theirs");
    }

    [Fact]
    public async Task GetIcebreakerStatus_BeforeAndAfterResponding_ReflectsOnlyCallersOwnResponse()
    {
        // The waiting screen needs to know "did *I* already answer" on every
        // remount (not "did both of us"), independent of local mutation state
        // — see IcebreakerStatusResponse's comment for why.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);

        var before = Assert.IsType<OkObjectResult>(await controller.GetIcebreakerStatus(match.Id, icebreaker.Id));
        Assert.False(Assert.IsType<IcebreakerStatusResponse>(before.Value).HasResponded);

        Db.IcebreakerResponses.Add(new IcebreakerResponse { MatchId = match.Id, IcebreakerId = icebreaker.Id, UserId = initiator.Id, Answer = "Mine" });
        await Db.SaveChangesAsync();

        var after = Assert.IsType<OkObjectResult>(await controller.GetIcebreakerStatus(match.Id, icebreaker.Id));
        Assert.True(Assert.IsType<IcebreakerStatusResponse>(after.Value).HasResponded);

        // Only the receiver's own status flips — the initiator answering alone
        // doesn't make it look like the receiver already responded too.
        var receiverController = BuildController(receiver.Id);
        var receiverStatus = Assert.IsType<OkObjectResult>(await receiverController.GetIcebreakerStatus(match.Id, icebreaker.Id));
        Assert.False(Assert.IsType<IcebreakerStatusResponse>(receiverStatus.Value).HasResponded);
    }

    [Fact]
    public async Task GetIcebreakerStatus_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        var strangerId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(strangerId));
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);

        var result = Assert.IsType<ObjectResult>(await controller.GetIcebreakerStatus(match.Id, icebreaker.Id));
        Assert.Equal(403, result.StatusCode);
    }
}
