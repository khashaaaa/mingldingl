using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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
        var videoToken = new VideoTokenService(config);

        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var loot = new LootService(Db, score);
        var milestones = new MilestoneService(Db);

        var controller = new VideoController(Db, videoToken, score, quests, loot, milestones)
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
        // Bug 1 (IDOR): MarkComplete used to never fetch the match or check
        // participation at all, so any authenticated user could farm score by
        // supplying an arbitrary matchId they had nothing to do with.
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
    public async Task MarkComplete_VideoCallNotUnlocked_ReturnsForbidden()
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
        // Bug 1 (unlimited farming): with no one-time guard, looping this
        // endpoint for the same matchId farmed unlimited +30 score. The fix
        // claims a separate one-shot VideoRewardClaimed flag atomically.
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);

        var controller = BuildController(initiatorId);

        var first = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        var firstOk = Assert.IsType<OkObjectResult>(first);
        var firstBody = Assert.IsType<VideoCompleteResponse>(firstOk.Value);

        var second = await controller.MarkComplete(new VideoCompleteDto(match.Id));
        Assert.Equal(403, Assert.IsType<ObjectResult>(second).StatusCode);

        // Assert on the "VideoCallDone" ScoreEvent specifically, not the user's
        // TotalScore — the daily quest rotation (QuestService.QuestsForDate) may
        // independently award "video" quest XP on some dates, which is unrelated
        // to the one-time-award guard under test here.
        var videoCallEvents = await Db.ScoreEvents
            .Where(e => e.UserId == initiatorId && e.EventType == "VideoCallDone")
            .ToListAsync();
        Assert.Single(videoCallEvents);
        Assert.Equal(30, videoCallEvents.Single().Delta);

        // firstBody.Awarded is the base 30 plus whatever the same quest
        // rotation independently awarded via "QuestComplete" — it must equal
        // the two added together, whichever date this ran on.
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
        // Regression guard: an earlier version of the MarkComplete fix reused
        // VideoCallUnlocked itself as the one-shot reward gate, which flipped
        // it false on first completion and permanently locked GetToken out
        // for that match afterward — a couple could never video call again
        // after their first completed call. VideoRewardClaimed must be the
        // only thing MarkComplete touches; VideoCallUnlocked must survive.
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
}
