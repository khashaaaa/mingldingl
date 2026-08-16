using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests.Integration;

namespace MinglDingl.Engine.Tests.Services;

public class DailyMaintenanceBackgroundServiceTests : IntegrationTestBase
{
    // The service resolves AppDbContext/ScoreService from a scope factory in
    // production (one scope per hourly sweep); tests need the sweep to run
    // against this test's own already-open transaction instead, so this scope
    // factory always hands back the test's existing provider rather than
    // creating a new one.
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

    private DailyMaintenanceBackgroundService BuildService()
    {
        var provider = new ServiceCollection()
            .AddSingleton(Db)
            .AddSingleton(new ScoreService(Db, new ConfigService()))
            .BuildServiceProvider();
        return new DailyMaintenanceBackgroundService(
            new SingleProviderScopeFactory(provider),
            NullLogger<DailyMaintenanceBackgroundService>.Instance);
    }

    [Fact]
    public async Task RunSweepAsync_RevertsExpiredMembershipToFree()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(-1); // lapsed yesterday
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Equal("Free", reloaded!.MembershipLevel);
        Assert.Null(reloaded.MembershipExpiresAt);
    }

    [Fact]
    public async Task RunSweepAsync_AnonymizesUser_AlsoClearsReferralCode()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.ReferralCode = "ABC123";
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriod - TimeSpan.FromDays(1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.True(reloaded!.IsDeleted);
        Assert.Null(reloaded.ReferralCode);
    }

    [Fact]
    public async Task RunSweepAsync_LeavesActiveMembershipUntouched()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(10); // still active
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.Equal("Gold", reloaded!.MembershipLevel);
        Assert.NotNull(reloaded.MembershipExpiresAt);
    }

    [Fact]
    public async Task RunSweepAsync_PendingShipOlderThan14Days_ExpiresIt()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow.AddDays(-15),
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        Assert.Equal("Expired", reloaded.Status);
    }

    [Fact]
    public async Task RunSweepAsync_PendingShipWithin14Days_LeftUntouched()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        Assert.Equal("Pending", reloaded.Status);
    }
}
