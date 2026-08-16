using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests.Integration;

public class MessagesControllerIntegrationTests : IntegrationTestBase
{
    private MessagesController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var milestones = new MilestoneService(Db);
        var push = new PushNotificationService(new HttpClient(), Db);
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(new HttpClient(), mockConfig.Object);
        var controller = new MessagesController(Db, score, quests, milestones, push, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private async Task<Match> SeedMatchWithMessages(int count)
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(initiatorId), NewCompleteUser(receiverId));
        var match = new Match { Id = Guid.NewGuid(), InitiatorId = initiatorId, ReceiverId = receiverId, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var baseTime = DateTime.UtcNow.AddHours(-1);
        for (int i = 0; i < count; i++)
        {
            Db.Messages.Add(new Message
            {
                Id = Guid.NewGuid(),
                MatchId = match.Id,
                SenderId = initiatorId,
                Content = $"message {i}",
                // Strictly increasing timestamps so ordering assertions are
                // unambiguous — real inserts get this for free from DateTime.UtcNow.
                CreatedAt = baseTime.AddSeconds(i),
            });
        }
        await Db.SaveChangesAsync();
        return match;
    }

    [Fact]
    public async Task GetMessages_MoreThanDefaultLimit_ReturnsOnlyMostRecentBounded()
    {
        // Regression test: GetMessages used to load a match's entire message
        // history with no bound at all. It's now capped to the most recent
        // 50 by default — this seeds more than that and asserts the response
        // is bounded, contains only the newest messages, and is still
        // ordered oldest-first (the shape hooks/useChat.ts expects).
        var match = await SeedMatchWithMessages(60);

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(50, items.Count);
        // Oldest-first: the first 10 messages (indices 0-9) should have been
        // dropped, so the earliest item returned is "message 10".
        Assert.Equal("message 10", items[0].Content);
        Assert.Equal("message 59", items[^1].Content);
        Assert.True(items.SequenceEqual(items.OrderBy(m => m.CreatedAt)), "response should stay oldest-first");
    }

    [Fact]
    public async Task GetMessages_FewerThanDefaultLimit_ReturnsAllInAscendingOrder()
    {
        var match = await SeedMatchWithMessages(5);

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(5, items.Count);
        Assert.Equal("message 0", items[0].Content);
        Assert.Equal("message 4", items[^1].Content);
    }

    [Fact]
    public async Task GetMessages_WithBeforeCursor_ReturnsOlderPageAndExcludesCursorMessage()
    {
        var match = await SeedMatchWithMessages(10);
        var all = await Db.Messages.AsNoTracking()
            .Where(m => m.MatchId == match.Id)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();
        var cursor = all[6].CreatedAt; // "message 6"

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id, before: cursor, limit: 50));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(6, items.Count); // messages 0-5
        Assert.DoesNotContain(items, m => m.Content == "message 6");
        Assert.Equal("message 0", items[0].Content);
        Assert.Equal("message 5", items[^1].Content);
    }

    [Fact]
    public async Task GetMessages_LimitClampedAboveMax()
    {
        var match = await SeedMatchWithMessages(5);

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id, limit: 10_000));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(5, items.Count); // all 5 present; clamp just shouldn't blow up or misbehave
    }

    [Fact]
    public async Task GetMessages_CallerNotAParticipant_ReturnsForbidden()
    {
        var match = await SeedMatchWithMessages(1);
        var outsiderId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(outsiderId));
        await Db.SaveChangesAsync();

        var controller = BuildController(outsiderId);
        var result = await controller.GetMessages(match.Id);

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    // No happy-path test for SendMessage's success case: like RequestMatch
    // (see MatchesControllerIntegrationTests.cs's Block_EndsMatchAnd... test
    // comment), SendMessage opens its own internal transaction (to atomically
    // pair the message insert with the UPDATE...RETURNING count increment —
    // see MessagesController.cs's comment on that). Calling it directly here
    // would nest a second BeginTransactionAsync inside IntegrationTestBase's
    // own wrapping transaction on the same connection, which Postgres/Npgsql
    // rejects outright ("connection is already in a transaction") — this
    // isn't a bug in SendMessage, just a limitation of this rollback-based
    // test harness for any action shaped this way. The forbidden-path test
    // below still covers the auth guard, which runs before the transaction
    // opens.

    [Fact]
    public async Task SendMessage_CallerNotAParticipant_ReturnsForbiddenAndDoesNotPersist()
    {
        var match = await SeedMatchWithMessages(0);
        var outsiderId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(outsiderId));
        await Db.SaveChangesAsync();

        var controller = BuildController(outsiderId);
        var result = await controller.SendMessage(match.Id, new SendMessageRequest("Hi"));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.False(await Db.Messages.AsNoTracking().AnyAsync(m => m.MatchId == match.Id));
    }
}
