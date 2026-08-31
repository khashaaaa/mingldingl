using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class EngagementControllerIntegrationTests : IntegrationTestBase
{
    private EngagementController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score, NullLogger<QuestService>.Instance);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
        var controller = new EngagementController(Db, new EngagementService(Db, score), score, quests, loot, milestones, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task RespondQuiz_SubmittedTwiceWithSameAnswers_DoesNotDuplicateRowOrDoubleAwardScore()
    {
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

        var questEvents = Db.ScoreEvents.Where(e => e.UserId == userId && e.EventType == "QuestComplete").ToList();
        Assert.True(questEvents.Count <= 1, "QuestComplete must never be awarded more than once for two identical submissions");

        var reloadedUser = await Db.Users.FindAsync(userId);
        int expectedScore = 15 + questEvents.Sum(e => e.Delta);
        Assert.Equal(expectedScore, reloadedUser!.TotalScore);
    }

    [Fact]
    public async Task RespondIcebreaker_CallerNotAMatchParticipant_ReturnsForbidden()
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
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);
        Db.UserMilestones.Add(new UserMilestone { UserId = userId, MilestoneId = "first_match" });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);

        var first = Assert.IsType<OkObjectResult>(await controller.OpenMilestone("first_match"));
        var firstBody = Assert.IsType<OpenMilestoneResponse>(first.Value);
        Assert.False(firstBody.AlreadyOpened);
        Assert.Equal(25, firstBody.Awarded);

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

        var receiverController = BuildController(receiver.Id);
        var receiverStatus = Assert.IsType<OkObjectResult>(await receiverController.GetIcebreakerStatus(match.Id, icebreaker.Id));
        Assert.False(Assert.IsType<IcebreakerStatusResponse>(receiverStatus.Value).HasResponded);
    }

    [Fact]
    public async Task RespondIcebreaker_BothRespond_AwardsFirstIcebreakerMilestoneToBothParticipants()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);

        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        var initiatorController = BuildController(initiator.Id);
        await initiatorController.RespondIcebreaker(match.Id, new IcebreakerRespondDto(icebreaker.Id, "Mine"));

        Db.ChangeTracker.Clear();
        Assert.Empty(Db.UserMilestones.Where(m => m.MilestoneId == "first_icebreaker"));

        var receiverController = BuildController(receiver.Id);
        await receiverController.RespondIcebreaker(match.Id, new IcebreakerRespondDto(icebreaker.Id, "Theirs"));

        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserMilestones.Where(m => m.UserId == initiator.Id && m.MilestoneId == "first_icebreaker"));
        Assert.Single(Db.UserMilestones.Where(m => m.UserId == receiver.Id && m.MilestoneId == "first_icebreaker"));
    }

    [Fact]
    public async Task RespondQuiz_FirstResponse_AwardsFirstQuizMilestoneOnlyOnce()
    {
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
        Assert.Single(Db.UserMilestones.Where(m => m.UserId == userId && m.MilestoneId == "first_quiz"));
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
