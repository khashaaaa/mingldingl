using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminTownSquareControllerIntegrationTests : IntegrationTestBase
{
    private AdminTownSquareController BuildController() => new(Db);

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

        var item = Assert.Single(page.Items);
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
