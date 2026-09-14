using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

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

    /// <summary>
    /// SaveChanges accepts what it wrote as soon as it succeeds, before the commit. When the commit
    /// then failed transiently the rows were rolled back, but the tracker already believed them
    /// written — so the retry set the same values, found no changes, wrote nothing and committed.
    /// </summary>
    [Fact]
    public async Task InTransactionAsync_CommitFailsTransiently_TheRetryStillWritesTheChanges()
    {
        var interceptor = new FailFirstArmedCommit();
        await using var ctx = NewUncommittedContext(dataSource => new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(dataSource, o => o.ExecutionStrategy(deps => new RetryOnTestFailure(deps)))
            .AddInterceptors(interceptor)
            .ConfigureWarnings(w => w.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options);

        var user = NewCompleteUser();
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();
        try
        {
            interceptor.Armed = true;
            await ctx.InTransactionAsync(async () =>
            {
                user.Bio = "written on the retry";
                await ctx.SaveChangesAsync();
            });

            Assert.Equal(2, interceptor.Commits);
            await using var check = NewUncommittedContext();
            Assert.Equal("written on the retry", (await check.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).Bio);
        }
        finally
        {
            interceptor.Armed = false;
            await ctx.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        }
    }

    private sealed class TransientTestException : Exception;

    private sealed class RetryOnTestFailure : ExecutionStrategy
    {
        public RetryOnTestFailure(ExecutionStrategyDependencies dependencies)
            : base(dependencies, 3, TimeSpan.FromMilliseconds(1)) { }

        protected override bool ShouldRetryOn(Exception exception) => exception is TransientTestException;
    }

    private sealed class FailFirstArmedCommit : DbTransactionInterceptor
    {
        public bool Armed { get; set; }
        public int Commits { get; private set; }

        public override ValueTask<InterceptionResult> TransactionCommittingAsync(
            DbTransaction transaction, TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
        {
            if (Armed && Commits++ == 0) throw new TransientTestException();
            return base.TransactionCommittingAsync(transaction, eventData, result, cancellationToken);
        }
    }
}
