using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests;

namespace MinglDingl.Engine.Tests.Integration;

public class VideoControllerIntegrationTests : IntegrationTestBase
{
    private VideoController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;

        var configValues = new Dictionary<string, string?>
        {
            ["Agora:AppId"] = "test_app_id",
            ["Agora:AppCertificate"] = "test_cert",
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
        var videoToken = new VideoTokenService(config, TestHostEnvironment.Development);

        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score, NullLogger<QuestService>.Instance);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var appConfig = new ConfigService();
        var broadcast = BuildTestBroadcast();
        var push = new PushNotificationService(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance);

        var controller = new VideoController(Db, videoToken, score, quests, loot, milestones, appConfig, broadcast, push)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private async Task<Match> SeedMatchAsync(Guid initiatorId, Guid receiverId, bool videoCallUnlocked = true)
    {
        var initiator = NewCompleteUser(initiatorId);
        var receiver = NewCompleteUser(receiverId);
        Db.Users.AddRange(initiator, receiver);

        var match = new Match
        {
            InitiatorId = initiatorId,
            ReceiverId = receiverId,
            Status = "Active",
            VideoCallUnlocked = videoCallUnlocked,
            FlameRiteAcceptedAt = videoCallUnlocked ? DateTime.UtcNow : null,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return match;
    }

    [Fact]
    public async Task MarkComplete_MatchNotFound_ReturnsNotFound()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.MarkComplete(new VideoCompleteDto(Guid.NewGuid()));

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task MarkComplete_CallerNotParticipant_ReturnsForbiddenAndDoesNotAwardScore()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var outsiderId = Guid.NewGuid();
        var outsider = NewCompleteUser(outsiderId);
        Db.Users.Add(outsider);
        await Db.SaveChangesAsync();
        int scoreBefore = outsider.TotalScore;

        var controller = BuildController(outsiderId);
        var result = await controller.MarkComplete(new VideoCompleteDto(match.Id));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);

        var reloadedOutsider = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == outsiderId);
        Assert.Equal(scoreBefore, reloadedOutsider.TotalScore);
    }

    [Fact]
    public async Task MarkComplete_RiteNotAccepted_ReturnsForbidden()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId, videoCallUnlocked: false);

        var controller = BuildController(initiatorId);
        var result = await controller.MarkComplete(new VideoCompleteDto(match.Id));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task MarkComplete_CalledTwiceForSameMatch_OnlyFirstCallAwardsScore()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var controller = BuildController(initiatorId);

        var first = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        var firstOk = Assert.IsType<OkObjectResult>(first);
        var firstBody = Assert.IsType<VideoCompleteResponse>(firstOk.Value);

        var second = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        Assert.Equal(403, Assert.IsType<ObjectResult>(second).StatusCode);

        var videoCallEvents = await Db.ScoreEvents
            .Where(e => e.UserId == initiatorId && e.EventType == "VideoCallDone")
            .ToListAsync();
        Assert.Single(videoCallEvents);
        Assert.Equal(30, videoCallEvents.Single().Delta);

        int questBonus = await Db.ScoreEvents
            .Where(e => e.UserId == initiatorId && e.EventType == "QuestComplete")
            .SumAsync(e => e.Delta);
        Assert.Equal(30 + questBonus, firstBody.Awarded);

        var reloadedMatch = await Db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
        Assert.True(reloadedMatch.VideoRewardClaimed);
    }

    [Fact]
    public async Task MarkComplete_DoesNotRevokeVideoCallCapability_GetTokenStillWorksAfterward()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var controller = BuildController(initiatorId);
        var completeResult = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        Assert.IsType<OkObjectResult>(completeResult);

        var reloadedMatch = await Db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
        Assert.True(reloadedMatch.VideoCallUnlocked, "the durable video-call capability must not be revoked by completing a call");
        Assert.True(reloadedMatch.VideoRewardClaimed);

        var tokenResult = await controller.GetToken(new VideoTokenRequestDto(match.Id));
        Assert.IsType<OkObjectResult>(tokenResult);
    }

    private VideoController BuildControllerWithBroadcast(Guid userId, SupabaseBroadcastService broadcast)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var configValues = new Dictionary<string, string?>
        {
            ["Agora:AppId"] = "test_app_id",
            ["Agora:AppCertificate"] = "test_cert",
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
        var videoToken = new VideoTokenService(config, TestHostEnvironment.Development);
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score, NullLogger<QuestService>.Instance);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = new PushNotificationService(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance);
        return new VideoController(Db, videoToken, score, quests, loot, milestones, new ConfigService(), broadcast, push)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    [Fact]
    public async Task MarkComplete_BroadcastsFlameRiteCompleted()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var (broadcast, handler) = BuildCapturingBroadcast();
        var controller = BuildControllerWithBroadcast(initiatorId, broadcast);
        var result = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        Assert.IsType<OkObjectResult>(result);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("\"app-nudges\"", handler.LastRequestBody);
        Assert.Contains("\"flame_rite_completed\"", handler.LastRequestBody);
        Assert.Contains($"\"matchId\":\"{match.Id}\"", handler.LastRequestBody);
        Assert.Contains($"\"userId\":\"{initiatorId}\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task GetToken_MatchNotActive_ReturnsForbidden()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);
        match.Status = "Unmatched";
        await Db.SaveChangesAsync();

        var controller = BuildController(initiatorId);
        var result = await controller.GetToken(new VideoTokenRequestDto(match.Id));
        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task MarkComplete_MatchNotActive_ReturnsForbiddenAndDoesNotClaimReward()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);
        match.Status = "Ghosted";
        await Db.SaveChangesAsync();

        var controller = BuildController(initiatorId);
        var result = await controller.MarkComplete(new VideoCompleteDto(match.Id));

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
        var reloaded = await Db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
        Assert.False(reloaded.VideoRewardClaimed);
    }
}
