using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests.Integration;

namespace MinglDingl.Engine.Tests.Services;

public class TownSquareSchedulerBackgroundServiceTests : IntegrationTestBase
{
    private class SingleProviderScopeFactory : IServiceScopeFactory
    {
        private readonly IServiceProvider _provider;
        public SingleProviderScopeFactory(IServiceProvider provider) => _provider = provider;
        public IServiceScope CreateScope() => new NonDisposingScope(_provider);

        private class NonDisposingScope : IServiceScope
        {
            public NonDisposingScope(IServiceProvider provider) => ServiceProvider = provider;
            public IServiceProvider ServiceProvider { get; }
            public void Dispose() { }
        }
    }

    private TownSquareSchedulerBackgroundService BuildService()
    {
        var provider = new ServiceCollection()
            .AddSingleton(Db)
            .AddSingleton(new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush()))
            .BuildServiceProvider();
        return new TownSquareSchedulerBackgroundService(
            new SingleProviderScopeFactory(provider),
            NullLogger<TownSquareSchedulerBackgroundService>.Instance);
    }

    private static User NewGenderedUser(string gender)
    {
        var user = NewCompleteUser();
        user.Gender = gender;
        return user;
    }

    private async Task<TownSquareSession> SeedOpenSessionWithRsvps(DateTime rsvpClosesAt, DateTime scheduledStartAt, int pairs = 1)
    {
        Db.Icebreakers.Add(new Icebreaker { QuestionText = "Favorite trip?", Type = "OpenText", IsActive = true });
        var session = new TownSquareSession
        {
            RsvpOpensAt = DateTime.UtcNow.AddDays(-1),
            RsvpClosesAt = rsvpClosesAt,
            ScheduledStartAt = scheduledStartAt,
            Status = "Open",
        };
        Db.TownSquareSessions.Add(session);

        for (int i = 0; i < pairs; i++)
        {
            var man = NewGenderedUser("Male");
            var woman = NewGenderedUser("Female");
            Db.Users.AddRange(man, woman);
            Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = man.Id, RsvpAt = DateTime.UtcNow.AddMinutes(i) });
            Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = woman.Id, RsvpAt = DateTime.UtcNow.AddMinutes(i) });
        }

        await Db.SaveChangesAsync();
        return session;
    }

    [Fact]
    public async Task RunSweepAsync_OpenSessionPastRsvpClose_LocksRoster()
    {
        var session = await SeedOpenSessionWithRsvps(
            rsvpClosesAt: DateTime.UtcNow.AddMinutes(-1),
            scheduledStartAt: DateTime.UtcNow.AddHours(1));

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Locked", reloaded!.Status);
    }

    [Fact]
    public async Task RunSweepAsync_OpenSessionRsvpStillOpen_LeavesUntouched()
    {
        var session = await SeedOpenSessionWithRsvps(
            rsvpClosesAt: DateTime.UtcNow.AddHours(1),
            scheduledStartAt: DateTime.UtcNow.AddHours(2));

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Open", reloaded!.Status);
    }

    [Fact]
    public async Task RunSweepAsync_LockedSessionAtScheduledStart_StartsSession()
    {
        var session = await SeedOpenSessionWithRsvps(
            rsvpClosesAt: DateTime.UtcNow.AddMinutes(-10),
            scheduledStartAt: DateTime.UtcNow.AddMinutes(-1));
        var townSquare = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush());
        await townSquare.LockRosterAsync(session.Id);

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", reloaded!.Status);
        Assert.Equal(1, reloaded.CurrentRoundNumber);
    }

    [Fact]
    public async Task RunSweepAsync_InProgressSessionPastRoundEnd_AdvancesRound()
    {
        var session = await SeedOpenSessionWithRsvps(
            rsvpClosesAt: DateTime.UtcNow.AddMinutes(-10),
            scheduledStartAt: DateTime.UtcNow.AddMinutes(-10),
            pairs: 2);
        var townSquare = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush());
        await townSquare.LockRosterAsync(session.Id);
        await townSquare.StartSessionAsync(session.Id);

        Db.ChangeTracker.Clear();
        var round1 = await Db.TownSquareRounds.FirstAsync(r => r.SessionId == session.Id && r.RoundNumber == 1);
        round1.StartsAt = DateTime.UtcNow.AddMinutes(-10);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", reloaded!.Status);
        Assert.Equal(2, reloaded.CurrentRoundNumber);
    }

    [Fact]
    public async Task RunSweepAsync_FullLifecycle_DrivesOpenThroughCompletedWithoutManualIntervention()
    {
        var session = await SeedOpenSessionWithRsvps(
            rsvpClosesAt: DateTime.UtcNow.AddMinutes(-10),
            scheduledStartAt: DateTime.UtcNow.AddSeconds(-30),
            pairs: 2);
        var scheduler = BuildService();

        await scheduler.RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var afterFirstSweep = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", afterFirstSweep!.Status);
        Assert.Equal(1, afterFirstSweep.CurrentRoundNumber);

        var round1 = await Db.TownSquareRounds.FirstAsync(r => r.SessionId == session.Id && r.RoundNumber == 1);
        round1.StartsAt = DateTime.UtcNow.AddMinutes(-10);
        await Db.SaveChangesAsync();

        await scheduler.RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var afterSecondSweep = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", afterSecondSweep!.Status);
        Assert.Equal(2, afterSecondSweep.CurrentRoundNumber);

        var round2 = await Db.TownSquareRounds.FirstAsync(r => r.SessionId == session.Id && r.RoundNumber == 2);
        round2.StartsAt = DateTime.UtcNow.AddMinutes(-10);
        await Db.SaveChangesAsync();

        await scheduler.RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var afterThirdSweep = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Completed", afterThirdSweep!.Status);
    }
}
