using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests;

namespace MinglDingl.Engine.Tests.Integration;

public class FlameRiteHandshakeIntegrationTests : IntegrationTestBase
{
    private VideoController BuildVideoController(
        Guid userId,
        PushNotificationService? push = null,
        SupabaseBroadcastService? broadcast = null,
        ConfigService? config = null)
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
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var appConfig = config ?? new ConfigService();
        var pushService = push ?? BuildTestPush();
        var broadcastService = broadcast ?? BuildTestBroadcast();

        var controller = new VideoController(Db, videoToken, score, quests, loot, milestones, appConfig, broadcastService, pushService)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private sealed class CapturingPushHandler : System.Net.Http.HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        }
    }

    private async Task<(Guid AId, Guid BId, Guid MatchId)> SeedMatchAsync(bool icebreakerComplete = true)
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        var match = new Match
        {
            InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active",
            IcebreakerComplete = icebreakerComplete,
            VideoCallUnlocked = icebreakerComplete,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return (a.Id, b.Id, match.Id);
    }

    [Fact]
    public async Task Propose_RecordsProposerAndTimestamp()
    {
        var (aId, _, matchId) = await SeedMatchAsync();

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId)));
        var state = Assert.IsType<FlameRiteStateResponse>(result.Value);

        Assert.Equal(aId, state.ProposedByUserId);
        Assert.Null(state.AcceptedAt);

        var match = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId);
        Assert.Equal(aId, match.FlameRiteProposedById);
        Assert.NotNull(match.FlameRiteProposedAt);
    }

    [Fact]
    public async Task Propose_BeforeTheIcebreaker_IsForbidden()
    {
        var (aId, _, matchId) = await SeedMatchAsync(icebreakerComplete: false);

        var result = await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Propose_WhenOneIsAlreadyOpen_ReturnsConflict()
    {
        var (aId, _, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        var result = await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Propose_ByANonParticipant_IsForbidden()
    {
        var (_, _, matchId) = await SeedMatchAsync();

        var result = await BuildVideoController(Guid.NewGuid()).ProposeRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Accept_ByTheOtherParticipant_OpensTheRite()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(bId).AcceptRite(new FlameRiteRequestDto(matchId)));
        var state = Assert.IsType<FlameRiteStateResponse>(result.Value);

        Assert.NotNull(state.AcceptedAt);
        Assert.NotNull((await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId)).FlameRiteAcceptedAt);
    }

    [Fact]
    public async Task Accept_PushesFlameRiteAcceptedToTheProposer()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        var proposerToken = await RegisterPushTokenAsync(aId);
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));
        var (push, handler) = BuildCapturingPush();

        await BuildVideoController(bId, push).AcceptRite(new FlameRiteRequestDto(matchId));

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains(proposerToken, handler.LastRequestBody);
        Assert.Contains("\"type\":\"flame_rite_accepted\"", handler.LastRequestBody);
        Assert.Contains($"\"matchId\":\"{matchId}\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task Accept_ByTheProposer_IsForbidden()
    {
        var (aId, _, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        var result = await BuildVideoController(aId).AcceptRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Accept_WithNoOpenProposal_IsForbidden()
    {
        var (_, bId, matchId) = await SeedMatchAsync();

        var result = await BuildVideoController(bId).AcceptRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Decline_ClearsTheProposalAndCostsNothing()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<OkObjectResult>(await BuildVideoController(bId).DeclineRite(new FlameRiteRequestDto(matchId)));

        var match = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId);
        Assert.Null(match.FlameRiteProposedById);
        Assert.Null(match.FlameRiteProposedAt);
        Assert.Null(match.FlameRiteAcceptedAt);

        Assert.Empty(await Db.ScoreEvents.Where(e => e.UserId == aId || e.UserId == bId).ToListAsync());
        Assert.Equal(1.0m, (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == bId)).ReputationScore);
    }

    [Fact]
    public async Task Decline_ThenProposeAgain_IsAllowed()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));
        await BuildVideoController(bId).DeclineRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<OkObjectResult>(
            await BuildVideoController(bId).ProposeRite(new FlameRiteRequestDto(matchId)));
    }

    [Fact]
    public async Task Decline_AfterRiteCompleted_DoesNotRevokeTheVideoCapability()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));
        await BuildVideoController(bId).AcceptRite(new FlameRiteRequestDto(matchId));
        Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId).MarkComplete(new VideoCompleteDto(matchId)));

        var declineResult = await BuildVideoController(bId).DeclineRite(new FlameRiteRequestDto(matchId));
        Assert.IsType<OkObjectResult>(declineResult);

        var match = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == matchId);
        Assert.NotNull(match.FlameRiteAcceptedAt);
        Assert.NotNull(match.FlameRiteCompletedAt);

        var tokenResult = await BuildVideoController(aId).GetToken(new VideoTokenRequestDto(matchId));
        Assert.IsType<OkObjectResult>(tokenResult);
    }

    [Fact]
    public async Task Propose_NotifiesTheOtherParticipantAndBroadcasts()
    {
        var (aId, bId, matchId) = await SeedMatchAsync();
        var recipient = await Db.Users.SingleAsync(u => u.Id == bId);
        recipient.PushEnabled = true;
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = bId, Token = "ExponentPushToken[abc]", Platform = "ios" });
        await Db.SaveChangesAsync();

        var pushHandler = new CapturingPushHandler();
        var push = BuildTestPush(pushHandler);
        var (broadcast, broadcastHandler) = BuildCapturingBroadcast();

        var result = await BuildVideoController(aId, push: push, broadcast: broadcast)
            .ProposeRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, pushHandler.RequestCount);
        Assert.NotNull(broadcastHandler.LastRequestBody);
        Assert.Contains("\"app-nudges\"", broadcastHandler.LastRequestBody);
        Assert.Contains("\"flame_rite_proposed\"", broadcastHandler.LastRequestBody);
    }

    [Fact]
    public async Task Accept_ByANonParticipant_IsForbidden()
    {
        var (aId, _, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        var result = await BuildVideoController(Guid.NewGuid()).AcceptRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Decline_ByANonParticipant_IsForbidden()
    {
        var (aId, _, matchId) = await SeedMatchAsync();
        await BuildVideoController(aId).ProposeRite(new FlameRiteRequestDto(matchId));

        var result = await BuildVideoController(Guid.NewGuid()).DeclineRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task Decline_WithNoOpenProposal_DoesNotBroadcast()
    {
        var (_, bId, matchId) = await SeedMatchAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();

        var result = await BuildVideoController(bId, broadcast: broadcast).DeclineRite(new FlameRiteRequestDto(matchId));

        Assert.IsType<OkObjectResult>(result);
        Assert.Null(handler.LastRequestBody);
    }

    [Fact]
    public async Task Propose_ReturnsTheConfiguredDurationMinutes()
    {
        var (aId, _, matchId) = await SeedMatchAsync();
        var config = new ConfigService();
        config.Set("dating.flamerite.duration_minutes", "7");

        var result = Assert.IsType<OkObjectResult>(
            await BuildVideoController(aId, config: config).ProposeRite(new FlameRiteRequestDto(matchId)));
        var state = Assert.IsType<FlameRiteStateResponse>(result.Value);

        Assert.Equal(7, state.DurationMinutes);
    }
}
