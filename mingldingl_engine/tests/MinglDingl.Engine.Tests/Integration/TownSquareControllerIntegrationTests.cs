using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using MinglDingl.Engine.Tests;

namespace MinglDingl.Engine.Tests.Integration;

public class TownSquareControllerIntegrationTests : IntegrationTestBase
{
    private TownSquareController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var videoToken = new VideoTokenService(mockConfig.Object, TestHostEnvironment.Development);
        var controller = new TownSquareController(Db, new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush()), videoToken)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private static User NewGenderedUser(string gender)
    {
        var user = NewCompleteUser();
        user.Gender = gender;
        return user;
    }

    private static TownSquareSession NewSession(string status = "Open")
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
    public async Task Rsvp_OpenSession_AddsRsvpAndReturnsOk()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.Rsvp(new TownSquareRsvpDto(session.Id));

        Assert.IsType<OkResult>(result);
        Db.ChangeTracker.Clear();
        Assert.True(await Db.TownSquareRsvps.AnyAsync(r => r.SessionId == session.Id && r.UserId == user.Id));
    }

    [Fact]
    public async Task Rsvp_SessionNotOpen_ReturnsBadRequest()
    {
        var user = NewCompleteUser();
        var session = NewSession(status: "Locked");
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.Rsvp(new TownSquareRsvpDto(session.Id));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancelRsvp_ExistingRsvp_RemovesItAndReturnsOk()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = user.Id });
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.CancelRsvp(session.Id);

        Assert.IsType<OkResult>(result);
        Db.ChangeTracker.Clear();
        Assert.False(await Db.TownSquareRsvps.AnyAsync(r => r.SessionId == session.Id && r.UserId == user.Id));
    }

    [Fact]
    public async Task GetNextSession_UpcomingOpenSession_ReturnsItWithRsvpFlag()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = user.Id });
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.GetNextSession();

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<NextSessionResponse>(ok.Value);
        Assert.Equal(session.Id, response.SessionId);
        Assert.True(response.IsRsvpd);
    }

    [Fact]
    public async Task GetNextSession_NoUpcomingSession_ReturnsNullSessionId()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.GetNextSession();

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<NextSessionResponse>(ok.Value);
        Assert.Null(response.SessionId);
    }

    private async Task<(TownSquareSession Session, TownSquarePairing Pairing)> SeedInProgressPairing()
    {
        Db.Icebreakers.Add(new Icebreaker { QuestionText = "Favorite trip?", Type = "OpenText", IsActive = true });
        var man = NewGenderedUser("Male");
        var woman = NewGenderedUser("Female");
        Db.Users.AddRange(man, woman);
        var session = NewSession();
        Db.TownSquareSessions.Add(session);
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = man.Id });
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = woman.Id });
        await Db.SaveChangesAsync();

        var townSquare = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush());
        await townSquare.LockRosterAsync(session.Id);
        await townSquare.StartSessionAsync(session.Id);

        Db.ChangeTracker.Clear();
        var reloadedSession = await Db.TownSquareSessions.FindAsync(session.Id);
        var pairing = await Db.TownSquarePairings.FirstAsync(p =>
            Db.TownSquareRounds.Any(r => r.Id == p.RoundId && r.SessionId == session.Id));
        return (reloadedSession!, pairing);
    }

    [Fact]
    public async Task GetCurrentRound_Participant_ReturnsPairingWithVideoToken()
    {
        var (session, pairing) = await SeedInProgressPairing();
        var controller = BuildController(pairing.UserAId);

        var result = await controller.GetCurrentRound(session.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<CurrentRoundResponse>(ok.Value);
        Assert.Equal(pairing.Id, response.PairingId);
        Assert.False(string.IsNullOrEmpty(response.VideoToken));
        Assert.False(string.IsNullOrEmpty(response.IcebreakerText));
    }

    [Fact]
    public async Task GetCurrentRound_SessionNotInProgress_ReturnsBadRequest()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var controller = BuildController(user.Id);
        var result = await controller.GetCurrentRound(session.Id);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task MarkJoined_Participant_SetsJoinedAt()
    {
        var (_, pairing) = await SeedInProgressPairing();
        var controller = BuildController(pairing.UserAId);

        var result = await controller.MarkJoined(pairing.Id);

        Assert.IsType<OkResult>(result);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquarePairings.FindAsync(pairing.Id);
        Assert.NotNull(reloaded!.UserAJoinedAt);
    }

    [Fact]
    public async Task RespondToPairing_OneSidedYes_ReturnsNullMatchId()
    {
        var (_, pairing) = await SeedInProgressPairing();
        var controller = BuildController(pairing.UserAId);

        var result = await controller.RespondToPairing(pairing.Id, new TownSquareRespondDto("Yes"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<TownSquareRespondResult>(ok.Value);
        Assert.Null(response.MatchId);
    }

    [Fact]
    public async Task RespondToPairing_NonParticipant_ReturnsForbidden()
    {
        var (_, pairing) = await SeedInProgressPairing();
        var stranger = NewGenderedUser("Male");
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();
        var controller = BuildController(stranger.Id);

        var result = await controller.RespondToPairing(pairing.Id, new TownSquareRespondDto("Yes"));

        var objResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, objResult.StatusCode);
    }
}
