using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>
/// Serial because it is the one test here that really commits. Every other integration test runs
/// inside the base class's rollback transaction, but <c>SendMessage</c> opens a transaction of its
/// own and cannot nest inside one — which is also why nothing else covers its happy path. Committed
/// rows are visible to anything running alongside, so this takes the database to itself.
/// </summary>
[Collection(SerialCollection.Name)]
public class MessageSendRetryIntegrationTests : IntegrationTestBase
{
    private static MessagesController BuildController(AppDbContext db, Guid userId)
    {
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
        return new MessagesController(db, score, quests, milestones, push, broadcast)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    /// <summary>
    /// The send runs inside an execution strategy, and Npgsql is configured with
    /// EnableRetryOnFailure, so the lambda really can run twice. EF leaves the Message from a failed
    /// attempt in the change tracker as Added, and the retry's SaveChanges used to insert it
    /// alongside the new one: two rows for one send, against a MessageCount that moved by one.
    /// Seeding that leftover stands in for a transient failure.
    /// </summary>
    [Fact]
    public async Task SendMessage_ChangeTrackerHoldsAnUnsavedMessage_InsertsOnlyTheNewOne()
    {
        await using var db = NewUncommittedContext();
        var senderId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var matchId = Guid.NewGuid();

        try
        {
            var sender = NewCompleteUser(senderId);
            var receiver = NewCompleteUser(receiverId);
            // Committed rows are searchable by anything that outlives this test, so they are not
            // left wearing the shared seed name.
            sender.DisplayName = $"retry-probe-{senderId:N}";
            receiver.DisplayName = $"retry-probe-{receiverId:N}";
            db.Users.AddRange(sender, receiver);
            db.Matches.Add(new Match { Id = matchId, InitiatorId = senderId, ReceiverId = receiverId, Status = "Active" });
            await db.SaveChangesAsync();

            db.Messages.Add(new Message
            {
                Id = Guid.NewGuid(),
                MatchId = matchId,
                SenderId = senderId,
                Content = "orphan from a failed attempt",
            });

            var controller = BuildController(db, senderId);
            Assert.IsType<OkObjectResult>(await controller.SendMessage(matchId, new SendMessageRequest("hello")));

            var rows = await db.Messages.AsNoTracking().Where(m => m.MatchId == matchId).ToListAsync();
            Assert.Equal("hello", Assert.Single(rows).Content);

            var reloaded = await db.Matches.AsNoTracking().FirstAsync(m => m.Id == matchId);
            Assert.Equal(1, reloaded.MessageCount);
        }
        finally
        {
            db.ChangeTracker.Clear();
            await db.Messages.Where(m => m.MatchId == matchId).ExecuteDeleteAsync();
            await db.ScoreEvents.Where(e => e.UserId == senderId || e.UserId == receiverId).ExecuteDeleteAsync();
            await db.UserMilestones.Where(m => m.UserId == senderId || m.UserId == receiverId).ExecuteDeleteAsync();
            await db.UserDailyQuests.Where(q => q.UserId == senderId || q.UserId == receiverId).ExecuteDeleteAsync();
            await db.Matches.Where(m => m.Id == matchId).ExecuteDeleteAsync();
            await db.Users.Where(u => u.Id == senderId || u.Id == receiverId).ExecuteDeleteAsync();
        }
    }
}
