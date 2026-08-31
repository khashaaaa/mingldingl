using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class FlameRitePersistenceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task FlameRiteFields_RoundTripThroughPostgres()
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        await Db.SaveChangesAsync();

        var proposedAt = new DateTime(2026, 8, 19, 10, 0, 0, DateTimeKind.Utc);
        var match = new Match
        {
            InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active",
            FlameRiteProposedById = a.Id,
            FlameRiteProposedAt = proposedAt,
            FlameRiteAcceptedAt = proposedAt.AddMinutes(3),
            FlameRiteCompletedAt = proposedAt.AddMinutes(9),
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var loaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);

        Assert.Equal(a.Id, loaded.FlameRiteProposedById);
        Assert.Equal(proposedAt, loaded.FlameRiteProposedAt);
        Assert.Equal(proposedAt.AddMinutes(3), loaded.FlameRiteAcceptedAt);
        Assert.Equal(proposedAt.AddMinutes(9), loaded.FlameRiteCompletedAt);
    }

    [Fact]
    public async Task NewMatch_HasNoRiteState()
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        var match = new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var loaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);

        Assert.Null(loaded.FlameRiteProposedById);
        Assert.Null(loaded.FlameRiteProposedAt);
        Assert.Null(loaded.FlameRiteAcceptedAt);
        Assert.Null(loaded.FlameRiteCompletedAt);
    }
}
