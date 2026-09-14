using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>
/// The lost-update and double-pay races in the score economy. A true race cannot be staged
/// deterministically on one connection, so each test writes "the other request" with raw SQL at
/// the point it would have landed and asserts on the conditional-update semantics.
/// </summary>
public class ScoreConcurrencyIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task AwardAsync_TrackedUser_LaterSaveKeepsConcurrentIncrement()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        await score.AwardAsync(user.Id, "FirstMessage");
        Assert.Equal(10, user.TotalScore);

        await Db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Users" SET "TotalScore" = "TotalScore" + 500 WHERE "Id" = {user.Id}""");
        user.Bio = "edited after the award";
        await Db.SaveChangesAsync();

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
        Assert.Equal(510, reloaded.TotalScore);
        Assert.Equal("edited after the award", reloaded.Bio);
    }

    [Fact]
    public async Task AwardWithDeltaAsync_CrossingThreshold_WritesTierInTheSameStatement()
    {
        var user = NewCompleteUser();
        user.TotalScore = 95;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        await score.AwardWithDeltaAsync(user.Id, "QuestComplete", 10);

        Assert.Equal("Opal", user.GemTier);
        Assert.False(Db.Entry(user).Property(u => u.GemTier).IsModified);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
        Assert.Equal(105, reloaded.TotalScore);
        Assert.Equal("Opal", reloaded.GemTier);
    }

    [Fact]
    public async Task TryAwardMatchReplyAsync_StopsPayingAtTheCap()
    {
        var (user, match) = await SeedMatchAsync();
        var config = new ConfigService();
        config.Set("score.match_reply.daily_cap_per_match", "2");
        var score = new ScoreService(Db, config);

        Assert.True(await score.TryAwardMatchReplyAsync(user.Id, match.Id));
        Assert.True(await score.TryAwardMatchReplyAsync(user.Id, match.Id));
        Assert.False(await score.TryAwardMatchReplyAsync(user.Id, match.Id));

        Assert.Equal(2, await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "MatchReply"));
    }

    [Fact]
    public async Task CompleteIcebreakerAsync_ClaimedByAnotherRequestAfterLoad_DoesNotPayAgain()
    {
        var (user, match) = await SeedMatchAsync();
        var engagement = new EngagementService(Db, new ScoreService(Db, new ConfigService()));

        // This request loaded the match with the flag unset; the other side's request then won.
        Assert.False(match.IcebreakerComplete);
        await Db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Matches" SET "IcebreakerComplete" = TRUE WHERE "Id" = {match.Id}""");

        Assert.False(await engagement.CompleteIcebreakerAsync(match.Id, match.InitiatorId, match.ReceiverId));
        Assert.Equal(0, await Db.ScoreEvents.CountAsync(e => e.EventType == "IcebreakerDone" && (e.UserId == match.InitiatorId || e.UserId == match.ReceiverId)));
    }

    [Fact]
    public async Task CompleteIcebreakerAsync_CalledTwice_PaysEachSideOnce()
    {
        var (_, match) = await SeedMatchAsync();
        var engagement = new EngagementService(Db, new ScoreService(Db, new ConfigService()));

        Assert.True(await engagement.CompleteIcebreakerAsync(match.Id, match.InitiatorId, match.ReceiverId));
        Assert.False(await engagement.CompleteIcebreakerAsync(match.Id, match.InitiatorId, match.ReceiverId));

        Assert.Equal(2, await Db.ScoreEvents.CountAsync(e => e.EventType == "IcebreakerDone" && (e.UserId == match.InitiatorId || e.UserId == match.ReceiverId)));
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
        Assert.True(reloaded.IcebreakerComplete);
        Assert.True(reloaded.VideoCallUnlocked);
    }

    [Fact]
    public async Task QuestIncrementAsync_PaysOnlyOnTheCompletingTick()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var probe = new QuestService(Db, new ScoreService(Db, config), config, NullLogger<QuestService>.Instance);
        var quest = probe.QuestsForDate(DateTime.UtcNow.Date)[0];
        config.Set($"quest.{quest.Id}.target", "2");
        config.Set($"quest.{quest.Id}.xp", "25");
        var quests = new QuestService(Db, new ScoreService(Db, config), config, NullLogger<QuestService>.Instance);

        Assert.Equal(0, await quests.IncrementAsync(user.Id, quest.Action));
        Assert.Equal(25, await quests.IncrementAsync(user.Id, quest.Action));
        Assert.Equal(0, await quests.IncrementAsync(user.Id, quest.Action));

        var row = await Db.UserDailyQuests.AsNoTracking().SingleAsync(r => r.UserId == user.Id && r.QuestId == quest.Id);
        Assert.Equal(2, row.Progress);
        Assert.NotNull(row.CompletedAt);
        Assert.Equal(1, await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "QuestComplete"));
    }

    [Fact]
    public async Task OathProven_SecondClaim_IsRejectedByTheOnceEverIndex()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        Assert.True(await score.TryAwardClaimedAsync(user.Id, "OathProven", 40));
        Assert.False(await score.TryAwardClaimedAsync(user.Id, "OathProven", 40));
    }

    [Fact]
    public async Task TryConsumeDailyMatchAsync_RefusesOnceTheBudgetIsSpent()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        int budget = score.DailyMatchBudget(user);
        await Db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Users" SET "DailyMatchesUsed" = {budget - 1} WHERE "Id" = {user.Id}""");

        Assert.Equal(budget, await score.TryConsumeDailyMatchAsync(user));
        Assert.Null(await score.TryConsumeDailyMatchAsync(user));

        Db.ChangeTracker.Clear();
        Assert.Equal(budget, (await Db.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id)).DailyMatchesUsed);
    }

    [Fact]
    public async Task RespondQuiz_UnknownQuiz_Returns404AndPaysNothing()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = Assert.IsAssignableFrom<ObjectResult>(await BuildEngagementController(user.Id)
            .RespondQuiz(Guid.NewGuid(), new QuizRespondDto(new() { [Guid.NewGuid()] = "A" }, null)));

        Assert.Equal(404, result.StatusCode);
        Assert.Equal(0, await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id));
    }

    [Fact]
    public async Task RespondQuiz_EmptyAnswers_Returns400()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Quiz" });
        await Db.SaveChangesAsync();

        var result = Assert.IsAssignableFrom<ObjectResult>(await BuildEngagementController(user.Id)
            .RespondQuiz(quizId, new QuizRespondDto(new(), null)));

        Assert.Equal(400, result.StatusCode);
        Assert.Empty(Db.QuizResponses.Where(r => r.UserId == user.Id));
    }

    [Fact]
    public async Task RespondQuiz_SameQuizTwiceInOneMatch_PaysQuizDoneOnce()
    {
        var (user, match) = await SeedMatchAsync();
        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Quiz" });
        await Db.SaveChangesAsync();

        var controller = BuildEngagementController(user.Id);
        var answers = new Dictionary<Guid, string> { [Guid.NewGuid()] = "A" };
        await controller.RespondQuiz(quizId, new QuizRespondDto(answers, match.Id));
        await controller.RespondQuiz(quizId, new QuizRespondDto(answers, match.Id));

        Assert.Equal(1, await Db.QuizResponses.CountAsync(r => r.UserId == user.Id && r.QuizId == quizId));
        Assert.Equal(1, await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "QuizDone"));
    }

    private async Task<(User User, Match Match)> SeedMatchAsync()
    {
        var user = NewCompleteUser();
        var other = NewCompleteUser();
        Db.Users.AddRange(user, other);
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = user.Id, ReceiverId = other.Id, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return (user, match);
    }

    private static DefaultHttpContext HttpContextFor(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        return httpContext;
    }

    private EngagementController BuildEngagementController(Guid userId)
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        return new EngagementController(Db, new EngagementService(Db, score), score,
            new QuestService(Db, score, config, NullLogger<QuestService>.Instance),
            new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestBroadcast(), config)
        {
            ControllerContext = new ControllerContext { HttpContext = HttpContextFor(userId) },
        };
    }
}
