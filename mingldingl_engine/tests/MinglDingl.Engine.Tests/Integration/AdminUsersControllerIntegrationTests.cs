using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminUsersControllerIntegrationTests : IntegrationTestBase
{
    private AdminUsersController BuildController() => new(Db, new AdminAuditService(Db), new ScoreService(Db, new ConfigService()), new ConfigService());

    [Fact]
    public async Task ListUsers_FiltersBySearchTerm()
    {
        var matching = NewCompleteUser();
        matching.DisplayName = "Zolboo Searchable";
        var other = NewCompleteUser();
        other.DisplayName = "Someone Else";
        Db.Users.AddRange(matching, other);
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.ListUsers("searchable", 1, 20));
        var page = Assert.IsType<PagedResponse<AdminUserListItemDto>>(result.Value);

        var item = Assert.Single(page.Items);
        Assert.Equal(matching.Id, item.Id);
    }

    [Fact]
    public async Task ListUsers_Paginates()
    {
        for (int i = 0; i < 3; i++) Db.Users.Add(NewCompleteUser());
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.ListUsers(null, 1, 2));
        var page = Assert.IsType<PagedResponse<AdminUserListItemDto>>(result.Value);

        Assert.Equal(2, page.Items.Count);
        Assert.True(page.HasMore);
    }

    [Fact]
    public async Task GetUser_ReturnsDetailWithRecentScoreEvents()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DailyLogin", Delta = 5 });
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Equal(user.DisplayName, detail.DisplayName);
        var scoreEvent = Assert.Single(detail.RecentScoreEvents);
        Assert.Equal("DailyLogin", scoreEvent.EventType);
    }

    [Fact]
    public async Task GetUser_ReturnsRecentMatchesShipsAndTownSquareRsvps()
    {
        var user = NewCompleteUser();
        var otherUser = NewCompleteUser();
        otherUser.DisplayName = "Match Partner";
        Db.Users.AddRange(user, otherUser);
        Db.Matches.Add(new Match { InitiatorId = user.Id, ReceiverId = otherUser.Id, Status = "Active", MessageCount = 3 });
        Db.Ships.Add(new Ship { ShipperUserId = user.Id, Status = "Pending" });
        var session = new TownSquareSession
        {
            RsvpOpensAt = DateTime.UtcNow.AddDays(-1), RsvpClosesAt = DateTime.UtcNow.AddHours(-1),
            ScheduledStartAt = DateTime.UtcNow, Status = "Open",
        };
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = user.Id });
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        var match = Assert.Single(detail.RecentMatches);
        Assert.Equal("Match Partner", match.OtherUserDisplayName);
        Assert.Equal(3, match.MessageCount);

        var ship = Assert.Single(detail.Ships);
        Assert.Equal("Shipper", ship.Role);

        var rsvp = Assert.Single(detail.TownSquareRsvps);
        Assert.Equal(session.Id, rsvp.SessionId);
    }

    [Fact]
    public async Task GetUser_UnknownId_ReturnsNotFound()
    {
        var controller = BuildController();
        var result = await controller.GetUser(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetDeletionRequests_ComputesDaysRemainingAndExcludesAlreadyDeleted()
    {
        var pending = NewCompleteUser();
        pending.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2);
        var alreadyDeleted = NewCompleteUser();
        alreadyDeleted.DeletionRequestedAt = DateTime.UtcNow.AddDays(-10);
        alreadyDeleted.IsDeleted = true;
        var notRequested = NewCompleteUser();
        Db.Users.AddRange(pending, alreadyDeleted, notRequested);
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var result = Assert.IsType<OkObjectResult>(await controller.GetDeletionRequests());
        var list = Assert.IsAssignableFrom<IReadOnlyList<AdminDeletionRequestDto>>(result.Value);

        // Scoped to this test's own users — the list is global, so any other pending deletion
        // in the database would break a bare Assert.Single.
        var entry = Assert.Single(list.Where(e => e.Id == pending.Id));
        Assert.Equal(5, entry.DaysRemaining);
        Assert.DoesNotContain(list, e => e.Id == alreadyDeleted.Id || e.Id == notRequested.Id);
    }

    [Fact]
    public async Task GetUser_IncludesOathNoShowAndFlameRiteFields()
    {
        var user = NewCompleteUser();
        user.Oath = "I will show up on time.";
        user.OathSwornAt = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
        user.OathProven = true;
        user.NoShowFlagCount = 2;
        var other = NewCompleteUser();
        Db.Users.AddRange(user, other);
        var proposedAt = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
        Db.Matches.Add(new Match
        {
            InitiatorId = user.Id, ReceiverId = other.Id, Status = "Active",
            FlameRiteProposedById = other.Id, FlameRiteProposedAt = proposedAt,
            FlameRiteAcceptedAt = proposedAt.AddHours(1), FlameRiteCompletedAt = proposedAt.AddDays(1),
        });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().GetUser(user.Id));
        var detail = Assert.IsType<AdminUserDetailDto>(result.Value);

        Assert.Equal("I will show up on time.", detail.Oath);
        Assert.Equal(user.OathSwornAt, detail.OathSwornAt);
        Assert.True(detail.OathProven);
        Assert.Equal(2, detail.NoShowFlagCount);

        var match = Assert.Single(detail.RecentMatches);
        Assert.Equal(other.Id, match.FlameRiteProposedById);
        Assert.Equal(proposedAt, match.FlameRiteProposedAt);
        Assert.Equal(proposedAt.AddHours(1), match.FlameRiteAcceptedAt);
        Assert.Equal(proposedAt.AddDays(1), match.FlameRiteCompletedAt);
    }
}
