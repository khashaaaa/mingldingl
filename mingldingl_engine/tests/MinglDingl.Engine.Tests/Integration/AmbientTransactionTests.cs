using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class AmbientTransactionTests : IntegrationTestBase
{
    [Fact]
    public async Task InTransactionAsync_JoinsAnAmbientTransactionRatherThanNesting()
    {
        // Every test here runs inside a per-test rollback transaction, and Npgsql refuses a nested
        // BeginTransaction outright — so joining is what makes a service that must be atomic
        // testable at all, rather than only through a separately committed context.
        Assert.NotNull(Db.Database.CurrentTransaction);

        var user = NewCompleteUser();
        await Db.InTransactionAsync(async () =>
        {
            Db.Users.Add(user);
            await Db.SaveChangesAsync();
        });

        Assert.NotNull(await Db.Users.FindAsync(user.Id));
    }

    [Fact]
    public async Task InTransactionAsync_LeavesInsertsQueuedByOtherCodeAlone()
    {
        // The retry guard drops entities an attempt added, because a retried delegate would insert
        // them a second time. It must only drop its own: this context is scoped and shared, so
        // clearing the tracker outright would throw away somebody else's unsaved work.
        var queuedElsewhere = NewCompleteUser();
        Db.Users.Add(queuedElsewhere);

        var mine = NewCompleteUser();
        await Db.InTransactionAsync(async () =>
        {
            Db.Users.Add(mine);
            await Db.SaveChangesAsync();
        });

        Assert.NotNull(await Db.Users.FindAsync(queuedElsewhere.Id));
        Assert.NotNull(await Db.Users.FindAsync(mine.Id));
    }
}
