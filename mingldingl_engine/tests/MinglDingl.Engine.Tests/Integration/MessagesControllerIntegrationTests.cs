using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class MessagesControllerIntegrationTests : IntegrationTestBase
{
    private MessagesController BuildController(Guid userId)
    {
        var db = Db;
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var config = new ConfigService();
        var score = new ScoreService(db, config);
        var quests = new QuestService(db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(db, NullLogger<MilestoneService>.Instance);
        var push = BuildTestPush(db);
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(new HttpClient(), mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
        var controller = new MessagesController(db, score, quests, milestones, push, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private Task<Match> SeedMatchWithMessages(int count) => SeedMatchWithMessages(count, TimeSpan.FromSeconds(1));

    private async Task<Match> SeedMatchWithMessages(int count, TimeSpan spacing)
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
                CreatedAt = baseTime + i * spacing,
            });
        }
        await Db.SaveChangesAsync();
        return match;
    }

    [Fact]
    public async Task GetMessages_MoreThanDefaultLimit_ReturnsOnlyMostRecentBounded()
    {
        var match = await SeedMatchWithMessages(60);

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(50, items.Count);

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
        var cursor = all[6].CreatedAt;

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id, before: cursor, limit: 50));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(6, items.Count);
        Assert.DoesNotContain(items, m => m.Content == "message 6");
        Assert.Equal("message 0", items[0].Content);
        Assert.Equal("message 5", items[^1].Content);
    }

    /// <summary>
    /// Two messages can share a `CreatedAt` to the tick. The page order breaks that tie on Id, so
    /// the cursor has to as well — a `CreatedAt < before` cursor alone skips every message that
    /// ties with the page boundary, and they are then unreachable by any later page.
    /// </summary>
    [Fact]
    public async Task GetMessages_MessagesSharingAnInstant_ArePagedWithoutLoss()
    {
        var match = await SeedMatchWithMessages(4, TimeSpan.Zero);
        var controller = BuildController(match.InitiatorId);

        var page1 = MessagesFrom(await controller.GetMessages(match.Id, limit: 2));
        var oldest = page1[0];
        var page2 = MessagesFrom(await controller.GetMessages(match.Id, before: oldest.CreatedAt, beforeId: oldest.Id, limit: 2));

        Assert.Equal(2, page1.Count);
        Assert.Equal(2, page2.Count);
        Assert.Equal(
            new[] { "message 0", "message 1", "message 2", "message 3" },
            page2.Concat(page1).Select(m => m.Content).Order().ToArray());
    }

    private static List<MessageResponse> MessagesFrom(IActionResult result) =>
        Assert.IsType<List<MessageResponse>>(Assert.IsType<OkObjectResult>(result).Value);

    [Fact]
    public async Task GetMessages_LimitClampedAboveMax()
    {
        var match = await SeedMatchWithMessages(5);

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id, limit: 10_000));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);

        Assert.Equal(5, items.Count);
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

    [Theory]
    [InlineData("Unmatched")]
    [InlineData("Ghosted")]
    public async Task SendMessage_MatchNotActive_ReturnsForbiddenAndDoesNotPersist(string status)
    {
        var match = await SeedMatchWithMessages(0);
        match.Status = status;
        await Db.SaveChangesAsync();

        var controller = BuildController(match.ReceiverId);
        var result = await controller.SendMessage(match.Id, new SendMessageRequest("Hello?"));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.False(await Db.Messages.AsNoTracking().AnyAsync(m => m.MatchId == match.Id));
    }

    [Fact]
    public async Task GetMessages_MatchNotActive_StillReturnsHistory()
    {
        var match = await SeedMatchWithMessages(3);
        match.Status = "Ghosted";
        await Db.SaveChangesAsync();

        var controller = BuildController(match.InitiatorId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMessages(match.Id));
        var items = Assert.IsType<List<MessageResponse>>(result.Value);
        Assert.Equal(3, items.Count);
    }
}
