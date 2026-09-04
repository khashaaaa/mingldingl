using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminTownSquareControllerIntegrationTests : IntegrationTestBase
{
    private AdminTownSquareController BuildController() =>
        new(Db, new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance), new AdminAuditService(Db));

    private static System.Security.Claims.ClaimsPrincipal AdminPrincipal() =>
        new(new System.Security.Claims.ClaimsIdentity(
            [new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "test-admin")], "AdminBearer"));

    private AdminTownSquareController BuildControllerWithUser(SupabaseBroadcastService? broadcast = null)
    {
        var controller = new AdminTownSquareController(
            Db, new TownSquareService(Db, broadcast ?? BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance), new AdminAuditService(Db));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext { User = AdminPrincipal() },
        };
        return controller;
    }

    private static CreateTownSquareSessionRequest ValidCreateRequest()
    {
        var start = DateTime.UtcNow.AddDays(3);
        return new CreateTownSquareSessionRequest(start.AddDays(-2), start.AddHours(-1), start);
    }

    private static TownSquareSession NewSession(string status)
    {
        var now = DateTime.UtcNow;
        return new TownSquareSession
        {
            RsvpOpensAt = now.AddDays(-1),
            RsvpClosesAt = now.AddHours(1),
            ScheduledStartAt = now.AddHours(2),
            Status = status,
        };
    }

    [Fact]
    public async Task CreateSession_ValidRequest_PersistsOpenSessionAndLogsAudit()
    {
        var req = ValidCreateRequest();

        var result = Assert.IsType<ObjectResult>(await BuildControllerWithUser().CreateSession(req));
        Assert.Equal(StatusCodes.Status201Created, result.StatusCode);
        var dto = Assert.IsType<AdminTownSquareSessionDto>(result.Value);

        Assert.Equal("Open", dto.Status);
        Assert.Equal(0, dto.CurrentRoundNumber);
        Assert.Equal(0, dto.RsvpCount);
        Assert.Equal(req.ScheduledStartAt, dto.ScheduledStartAt);

        Db.ChangeTracker.Clear();
        var stored = await Db.TownSquareSessions.SingleAsync(s => s.Id == dto.Id);
        Assert.Equal("Open", stored.Status);
        Assert.Equal(req.RsvpOpensAt, stored.RsvpOpensAt, TimeSpan.FromMilliseconds(1));
        Assert.Equal(req.RsvpClosesAt, stored.RsvpClosesAt, TimeSpan.FromMilliseconds(1));

        var logged = Db.AdminAuditLogs.Single(l => l.Action == "CreateTownSquareSession" && l.EntityId == dto.Id.ToString());
        Assert.Equal("test-admin", logged.AdminUsername);
        Assert.Equal("TownSquareSession", logged.EntityType);
    }

    [Fact]
    public async Task CreateSession_UnspecifiedKind_IsStoredAsUtc()
    {
        var start = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(3), DateTimeKind.Unspecified);
        var req = new CreateTownSquareSessionRequest(start.AddDays(-1), start.AddHours(-1), start);

        var result = Assert.IsType<ObjectResult>(await BuildControllerWithUser().CreateSession(req));
        var dto = Assert.IsType<AdminTownSquareSessionDto>(result.Value);

        Assert.Equal(DateTimeKind.Utc, dto.ScheduledStartAt.Kind);
        Assert.Equal(start.Ticks, dto.ScheduledStartAt.Ticks);
    }

    [Fact]
    public async Task CreateSession_RsvpOpensAfterCloses_ReturnsBadRequest()
    {
        var start = DateTime.UtcNow.AddDays(3);
        var req = new CreateTownSquareSessionRequest(start.AddHours(-1), start.AddHours(-2), start);

        var result = Assert.IsType<BadRequestObjectResult>(await BuildControllerWithUser().CreateSession(req));
        Assert.Contains("RsvpOpensAt", result.Value!.ToString());
        Assert.False(await Db.TownSquareSessions.AnyAsync(s => s.ScheduledStartAt == start));
    }

    [Fact]
    public async Task CreateSession_RsvpOpensEqualsCloses_ReturnsBadRequest()
    {
        var start = DateTime.UtcNow.AddDays(3);
        var req = new CreateTownSquareSessionRequest(start.AddHours(-1), start.AddHours(-1), start);

        Assert.IsType<BadRequestObjectResult>(await BuildControllerWithUser().CreateSession(req));
    }

    [Fact]
    public async Task CreateSession_RsvpClosesAfterStart_ReturnsBadRequest()
    {
        var start = DateTime.UtcNow.AddDays(3);
        var req = new CreateTownSquareSessionRequest(start.AddDays(-1), start.AddMinutes(5), start);

        var result = Assert.IsType<BadRequestObjectResult>(await BuildControllerWithUser().CreateSession(req));
        Assert.Contains("RsvpClosesAt", result.Value!.ToString());
    }

    [Fact]
    public async Task CreateSession_RsvpClosesEqualsStart_IsAllowed()
    {
        var start = DateTime.UtcNow.AddDays(3);
        var req = new CreateTownSquareSessionRequest(start.AddDays(-1), start, start);

        var result = Assert.IsType<ObjectResult>(await BuildControllerWithUser().CreateSession(req));
        Assert.Equal(StatusCodes.Status201Created, result.StatusCode);
    }

    [Fact]
    public async Task CreateSession_StartInPast_ReturnsBadRequest()
    {
        var start = DateTime.UtcNow.AddMinutes(-5);
        var req = new CreateTownSquareSessionRequest(start.AddDays(-1), start.AddHours(-1), start);

        var result = Assert.IsType<BadRequestObjectResult>(await BuildControllerWithUser().CreateSession(req));
        Assert.Contains("future", result.Value!.ToString());
    }

    [Fact]
    public async Task CancelSession_OpenSession_SetsCancelledBroadcastsAndLogsAudit()
    {
        var session = NewSession("Open");
        var rsvpUser = NewCompleteUser();
        Db.TownSquareSessions.Add(session);
        Db.Users.Add(rsvpUser);
        await Db.SaveChangesAsync();
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = rsvpUser.Id });
        await Db.SaveChangesAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();

        var result = Assert.IsType<OkObjectResult>(await BuildControllerWithUser(broadcast).CancelSession(session.Id));
        var dto = Assert.IsType<AdminTownSquareSessionDto>(result.Value);

        Assert.Equal("Cancelled", dto.Status);
        Assert.Equal(1, dto.RsvpCount);

        Db.ChangeTracker.Clear();
        Assert.Equal("Cancelled", (await Db.TownSquareSessions.SingleAsync(s => s.Id == session.Id)).Status);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("session-cancelled", handler.LastRequestBody);
        Assert.Contains($"townsquare:{session.Id}", handler.LastRequestBody);
        Assert.Contains("\"Cancelled\"", handler.LastRequestBody);

        var logged = Db.AdminAuditLogs.Single(l => l.Action == "CancelTownSquareSession" && l.EntityId == session.Id.ToString());
        Assert.Equal("test-admin", logged.AdminUsername);
        Assert.Equal("was Open", logged.Details);
    }

    [Fact]
    public async Task CancelSession_LockedSession_IsCancelled()
    {
        var session = NewSession("Locked");
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildControllerWithUser().CancelSession(session.Id));
        Assert.Equal("Cancelled", Assert.IsType<AdminTownSquareSessionDto>(result.Value).Status);
    }

    [Theory]
    [InlineData("InProgress")]
    [InlineData("Completed")]
    [InlineData("Cancelled")]
    public async Task CancelSession_NonCancellableStatus_ReturnsConflictAndLeavesStatus(string status)
    {
        var session = NewSession(status);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<ConflictObjectResult>(await BuildControllerWithUser().CancelSession(session.Id));
        Assert.Contains(status, result.Value!.ToString());

        Db.ChangeTracker.Clear();
        Assert.Equal(status, (await Db.TownSquareSessions.SingleAsync(s => s.Id == session.Id)).Status);
        Assert.False(Db.AdminAuditLogs.Any(l => l.Action == "CancelTownSquareSession" && l.EntityId == session.Id.ToString()));
    }

    [Fact]
    public async Task CancelSession_UnknownSession_ReturnsNotFound()
    {
        var result = await BuildControllerWithUser().CancelSession(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ListSessions_IncludesRsvpCount()
    {
        var session = new TownSquareSession
        {
            RsvpOpensAt = DateTime.UtcNow.AddDays(-1),
            RsvpClosesAt = DateTime.UtcNow.AddHours(-1),
            ScheduledStartAt = DateTime.UtcNow,
            Status = "Locked",
            CurrentRoundNumber = 1,
        };
        Db.TownSquareSessions.Add(session);
        var rsvpUser1 = NewCompleteUser();
        var rsvpUser2 = NewCompleteUser();
        Db.Users.AddRange(rsvpUser1, rsvpUser2);
        await Db.SaveChangesAsync();
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = rsvpUser1.Id });
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = rsvpUser2.Id });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().ListSessions(1, 20));
        var page = Assert.IsType<PagedResponse<AdminTownSquareSessionDto>>(result.Value);

        var item = Assert.Single(page.Items.Where(i => i.Id == session.Id));
        Assert.Equal(2, item.RsvpCount);
    }

    [Fact]
    public async Task GetSessionPairings_ReturnsDisplayNamesOrderedByRound()
    {
        var session = new TownSquareSession
        {
            RsvpOpensAt = DateTime.UtcNow.AddDays(-1),
            RsvpClosesAt = DateTime.UtcNow.AddHours(-1),
            ScheduledStartAt = DateTime.UtcNow,
            Status = "InProgress",
            CurrentRoundNumber = 1,
        };
        var icebreaker = new Icebreaker { QuestionText = "Fave food?" };
        Db.TownSquareSessions.Add(session);
        Db.Icebreakers.Add(icebreaker);
        var userA = NewCompleteUser();
        userA.DisplayName = "Round Ariunaa";
        var userB = NewCompleteUser();
        userB.DisplayName = "Round Ganbold";
        Db.Users.AddRange(userA, userB);
        await Db.SaveChangesAsync();

        var round = new TownSquareRound { SessionId = session.Id, RoundNumber = 1, IcebreakerId = icebreaker.Id, StartsAt = DateTime.UtcNow };
        Db.TownSquareRounds.Add(round);
        await Db.SaveChangesAsync();

        Db.TownSquarePairings.Add(new TownSquarePairing
        {
            RoundId = round.Id, UserAId = userA.Id, UserBId = userB.Id,
            UserAResponse = "Yes", UserBResponse = "Pending",
        });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().GetSessionPairings(session.Id));
        var pairings = Assert.IsType<List<AdminTownSquarePairingDto>>(result.Value);

        var pairing = Assert.Single(pairings);
        Assert.Equal("Round Ariunaa", pairing.UserADisplayName);
        Assert.Equal("Round Ganbold", pairing.UserBDisplayName);
        Assert.Equal("Yes", pairing.UserAResponse);
    }

    [Fact]
    public async Task GetSessionPairings_UnknownSession_ReturnsNotFound()
    {
        var result = await BuildController().GetSessionPairings(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }
}
