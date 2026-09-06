using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests;

namespace MinglDingl.Engine.Tests.Integration;

public class VideoControllerIntegrationTests : IntegrationTestBase
{
    private VideoController BuildController(Guid userId, ConfigService? appConfigOverride = null)
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

        var appConfig = appConfigOverride ?? new ConfigService();
        var score = new ScoreService(Db, appConfig);
        var quests = new QuestService(Db, score, appConfig, NullLogger<QuestService>.Instance);
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var broadcast = BuildTestBroadcast();
        var push = BuildTestPush();

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
    public async Task MarkComplete_CalledTwiceBySameParticipant_OnlyFirstCallAwardsScore()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var controller = BuildController(initiatorId);

        var first = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        var firstOk = Assert.IsType<OkObjectResult>(first);
        var firstBody = Assert.IsType<VideoCompleteResponse>(firstOk.Value);

        // A repeat call from the same participant is a normal outcome (a retry, or a second hang-up
        // event), so it reports a zero award rather than an error the app would surface as a failure.
        var second = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        var secondBody = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(second).Value);
        Assert.Equal(0, secondBody.Awarded);
        Assert.Null(secondBody.DroppedItem);

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

    /// <summary>
    /// Both people were on the same call, so both are paid. The claim used to be one flag on the
    /// match, which meant whoever hung up first took the score, the quest tick, the milestone and
    /// the loot roll, and the other participant got a zero-award response and nothing else.
    /// </summary>
    [Fact]
    public async Task MarkComplete_BothParticipants_EachEarnsTheirOwnReward()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var firstBody = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(
            await BuildController(initiatorId).MarkComplete(new VideoCompleteDto(match.Id))).Value);
        var secondBody = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(
            await BuildController(receiverId).MarkComplete(new VideoCompleteDto(match.Id))).Value);

        Assert.True(firstBody.Awarded > 0);
        Assert.True(secondBody.Awarded > 0, "the participant who hangs up second earned the same call");

        foreach (var userId in new[] { initiatorId, receiverId })
        {
            Assert.Single(await Db.ScoreEvents
                .Where(e => e.UserId == userId && e.EventType == "VideoCallDone")
                .ToListAsync());
            Assert.True(
                await Db.UserMilestones.AnyAsync(m => m.UserId == userId && m.MilestoneId == "first_video_call"),
                $"{userId} completed a video call and must hold the milestone");
        }

        var reloaded = await Db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
        Assert.True(reloaded.InitiatorVideoRewardClaimed);
        Assert.True(reloaded.ReceiverVideoRewardClaimed);
        Assert.True(reloaded.VideoRewardClaimed);
    }

    [Fact]
    public async Task MarkComplete_SecondParticipantCallingTwice_OnlyEarnsOnce()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var receiverController = BuildController(receiverId);
        await BuildController(initiatorId).MarkComplete(new VideoCompleteDto(match.Id));
        await receiverController.MarkComplete(new VideoCompleteDto(match.Id));
        var repeat = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(
            await receiverController.MarkComplete(new VideoCompleteDto(match.Id))).Value);

        Assert.Equal(0, repeat.Awarded);
        Assert.Null(repeat.DroppedItem);
        Assert.Single(await Db.ScoreEvents
            .Where(e => e.UserId == receiverId && e.EventType == "VideoCallDone")
            .ToListAsync());
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
        var appConfig = new ConfigService();
        var score = new ScoreService(Db, appConfig);
        var quests = new QuestService(Db, score, appConfig, NullLogger<QuestService>.Instance);
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = BuildTestPush();
        return new VideoController(Db, videoToken, score, quests, loot, milestones, appConfig, broadcast, push)
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
    public async Task GetToken_VideoDisabledInConfig_ReturnsNotFoundWithCode()
    {
        var initiatorId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, Guid.NewGuid());
        var config = new ConfigService();
        config.Set("video.enabled", "false");
        var controller = BuildController(initiatorId, config);

        var result = await controller.GetToken(new VideoTokenRequestDto(match.Id));

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("video.disabled", Assert.IsType<ErrorResponse>(notFound.Value).Code);
    }

    [Fact]
    public async Task ProposeRite_VideoDisabledInConfig_ReturnsNotFoundAndLeavesMatchUntouched()
    {
        var initiatorId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, Guid.NewGuid(), videoCallUnlocked: false);
        match.IcebreakerComplete = true;
        await Db.SaveChangesAsync();
        var config = new ConfigService();
        config.Set("video.enabled", "false");
        var controller = BuildController(initiatorId, config);

        var result = await controller.ProposeRite(new FlameRiteRequestDto(match.Id));

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("video.disabled", Assert.IsType<ErrorResponse>(notFound.Value).Code);
        Db.ChangeTracker.Clear();
        Assert.Null((await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id)).FlameRiteProposedById);
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

    [Fact]
    public async Task MarkComplete_FirstCompletedRite_GrantsFlamekeeperOnce()
    {
        var initiatorId = Guid.NewGuid();
        var firstMatch = await SeedMatchAsync(initiatorId, Guid.NewGuid());
        var otherReceiver = NewCompleteUser();
        var secondMatch = new Match { InitiatorId = initiatorId, ReceiverId = otherReceiver.Id, Status = "Active", VideoCallUnlocked = true, FlameRiteAcceptedAt = DateTime.UtcNow };
        Db.Users.Add(otherReceiver);
        Db.Matches.Add(secondMatch);
        await Db.SaveChangesAsync();
        var controller = BuildController(initiatorId);

        var first = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(
            await controller.MarkComplete(new VideoCompleteDto(firstMatch.Id))).Value);
        var second = Assert.IsType<VideoCompleteResponse>(Assert.IsType<OkObjectResult>(
            await controller.MarkComplete(new VideoCompleteDto(secondMatch.Id))).Value);

        Assert.Equal("title_flamekeeper", first.DroppedItem?.Id);
        Assert.Null(second.DroppedItem);
        Assert.True(second.Awarded > 0);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == initiatorId && i.ItemId == "title_flamekeeper"));
    }
}
