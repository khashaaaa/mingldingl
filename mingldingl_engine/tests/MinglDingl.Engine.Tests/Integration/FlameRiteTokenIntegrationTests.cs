using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests;

namespace MinglDingl.Engine.Tests.Integration;

public class FlameRiteTokenIntegrationTests : IntegrationTestBase
{
    private VideoController BuildVideoController(Guid userId, ConfigService? appConfig = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;

        var configValues = new Dictionary<string, string?>
        {
            ["Agora:AppId"] = "test_app_id",
            ["Agora:AppCertificate"] = "test_cert",
        };
        var agoraConfig = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
        var videoToken = new VideoTokenService(agoraConfig, TestHostEnvironment.Development);

        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score, NullLogger<QuestService>.Instance);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = new PushNotificationService(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance);
        var broadcast = BuildTestBroadcast();

        var controller = new VideoController(Db, videoToken, score, quests, loot, milestones, appConfig ?? new ConfigService(), broadcast, push)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private async Task<(Guid AId, Guid BId, Guid MatchId)> SeedAcceptedRiteAsync(bool accepted, bool completed = false)
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);

        var now = DateTime.UtcNow;
        var match = new Match
        {
            InitiatorId = a.Id,
            ReceiverId = b.Id,
            Status = "Active",
            IcebreakerComplete = true,
            VideoCallUnlocked = true,
            FlameRiteProposedById = a.Id,
            FlameRiteProposedAt = now,
            FlameRiteAcceptedAt = accepted ? now : null,
            FlameRiteCompletedAt = completed ? now : null,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return (a.Id, b.Id, match.Id);
    }

    private async Task CompleteIcebreakerForBothAsync(Match match, Guid aId, Guid bId)
    {
        var icebreaker = new Icebreaker { QuestionText = "Q?", Type = "text", IsActive = true };
        Db.Icebreakers.Add(icebreaker);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score, NullLogger<QuestService>.Instance);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var engagement = new EngagementService(Db, score);
        var broadcast = BuildTestBroadcast();

        EngagementController BuildController(Guid userId)
        {
            var httpContext = new DefaultHttpContext();
            httpContext.Items["UserId"] = userId;
            return new EngagementController(Db, engagement, score, quests, loot, milestones, broadcast)
            {
                ControllerContext = new ControllerContext { HttpContext = httpContext },
            };
        }

        await BuildController(aId).RespondIcebreaker(match.Id, new IcebreakerRespondDto(icebreaker.Id, "Mine"));
        await BuildController(bId).RespondIcebreaker(match.Id, new IcebreakerRespondDto(icebreaker.Id, "Theirs"));
    }

    [Fact]
    public async Task GetToken_BeforeAccept_IsForbidden()
    {
        var (aId, _, matchId) = await SeedAcceptedRiteAsync(accepted: false);

        var result = await BuildVideoController(aId).GetToken(new VideoTokenRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetToken_AfterAccept_IssuesAToken()
    {
        var (aId, _, matchId) = await SeedAcceptedRiteAsync(accepted: true);

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId).GetToken(new VideoTokenRequestDto(matchId)));
        var body = Assert.IsType<VideoTokenResponse>(result.Value);

        Assert.False(string.IsNullOrWhiteSpace(body.Token));
        Assert.Equal(matchId.ToString("N"), body.ChannelName);
    }

    [Fact]
    public async Task GetToken_BeforeCompletion_IssuesAShortTokenFromConfiguredDuration()
    {
        var (aId, _, matchId) = await SeedAcceptedRiteAsync(accepted: true, completed: false);
        var config = new ConfigService();
        config.Set("dating.flamerite.duration_minutes", "7");

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId, config).GetToken(new VideoTokenRequestDto(matchId)));
        var body = Assert.IsType<VideoTokenResponse>(result.Value);

        Assert.Equal(7u * 60, VideoTokenDecoder.DecodeTtlSeconds(body.Token));
    }

    [Fact]
    public async Task GetToken_AfterCompletion_IssuesTheLong24HourToken()
    {
        var (aId, _, matchId) = await SeedAcceptedRiteAsync(accepted: true, completed: true);
        var config = new ConfigService();
        config.Set("dating.flamerite.duration_minutes", "7");

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId, config).GetToken(new VideoTokenRequestDto(matchId)));
        var body = Assert.IsType<VideoTokenResponse>(result.Value);

        Assert.Equal(24u * 3600, VideoTokenDecoder.DecodeTtlSeconds(body.Token));
    }

    [Fact]
    public async Task MarkComplete_SetsFlameRiteCompletedAt()
    {
        var (aId, _, matchId) = await SeedAcceptedRiteAsync(accepted: true);

        Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId).MarkComplete(new VideoCompleteDto(matchId)));

        Assert.NotNull((await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId)).FlameRiteCompletedAt);
    }

    [Fact]
    public async Task MarkComplete_Twice_DoesNotMoveTheCompletionTimestamp()
    {
        var (aId, bId, matchId) = await SeedAcceptedRiteAsync(accepted: true);
        await BuildVideoController(aId).MarkComplete(new VideoCompleteDto(matchId));
        var first = (await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId)).FlameRiteCompletedAt;

        await BuildVideoController(bId).MarkComplete(new VideoCompleteDto(matchId));

        Assert.Equal(first, (await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId)).FlameRiteCompletedAt);
    }

    [Fact]
    public async Task CompletingTheIcebreaker_UnlocksTheVideoCapability()
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        var match = new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        await CompleteIcebreakerForBothAsync(match, a.Id, b.Id);

        var loaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.True(loaded.IcebreakerComplete);
        Assert.True(loaded.VideoCallUnlocked);
    }
}
