using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class OathPersistenceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task Oath_RoundTripsThroughPostgres()
    {
        var user = NewCompleteUser();
        user.Oath = "Bond";
        user.OathSwornAt = new DateTime(2026, 8, 19, 0, 0, 0, DateTimeKind.Utc);
        user.OathProven = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var loaded = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);

        Assert.Equal("Bond", loaded.Oath);
        Assert.Equal(new DateTime(2026, 8, 19, 0, 0, 0, DateTimeKind.Utc), loaded.OathSwornAt);
        Assert.True(loaded.OathProven);
    }

    [Fact]
    public async Task NewUser_DefaultsToUnsworn()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var loaded = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);

        Assert.Null(loaded.Oath);
        Assert.Null(loaded.OathSwornAt);
        Assert.False(loaded.OathProven);
    }
}
