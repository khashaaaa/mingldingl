using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Tests.Integration;

namespace MinglDingl.Engine.Tests.Services;

public class DailyMaintenanceBackgroundServiceTests : IntegrationTestBase
{
    private DailyMaintenanceBackgroundService BuildService(LocalFileStorageService? storage = null, ConfigService? config = null)
    {
        config ??= new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var provider = new ServiceCollection()
            .AddSingleton(Db)
            .AddSingleton(config)
            .AddSingleton(score)
            .AddSingleton(oaths)
            .AddSingleton(new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush()))
            .AddSingleton(storage ?? BuildTestStorage())
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
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(-1);
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
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
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
        user.MembershipExpiresAt = DateTime.UtcNow.AddDays(10);
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
    public async Task RunSweepAsync_ShipExpiryOverriddenInConfig_ExpiresYoungerPendingShips()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
        });
        await Db.SaveChangesAsync();
        var config = new ConfigService();
        config.Set("ships.expiry_days", "1");

        await BuildService(config: config).RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        Assert.Equal("Expired", reloaded.Status);
    }

    [Fact]
    public async Task RunSweepAsync_DeletionGraceOverriddenInConfig_AnonymisesSooner()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-2);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var config = new ConfigService();
        config.Set("account.deletion_grace_days", "1");

        await BuildService(config: config).RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(userId);
        Assert.True(reloaded!.IsDeleted);
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

    [Fact]
    public async Task RunSweepAsync_GhostsProvenAtFaultUser_DemotesTheirOath()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        silent.Oath = "Bond";
        silent.OathSwornAt = DateTime.UtcNow.AddDays(-10);
        silent.OathProven = true;
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloadedMatch = await Db.Matches.FindAsync(match.Id);
        var reloadedUser = await Db.Users.FindAsync(silent.Id);
        Assert.Equal("Ghosted", reloadedMatch!.Status);
        Assert.False(reloadedUser!.OathProven);
    }

    [Fact]
    public async Task RunSweepAsync_AnonymizingAUser_DeletesTheirPhotoFilesFromDisk()
    {
        // /uploads is public and unauthenticated, so clearing the column alone would leave the
        // photos fetchable by anyone holding an old URL.
        var storage = BuildTestStorage();
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        var user = NewCompleteUser();
        user.PhotoUrls = [url];
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildService(storage).RunSweepAsync(CancellationToken.None);

        Assert.False(storage.DeleteByPublicUrl(url), "the file should already be gone");
        Assert.Empty((await Db.Users.FindAsync(user.Id))!.PhotoUrls);
    }

    [Fact]
    public async Task RunSweepAsync_AnonymizingAUser_PurgesTheirPhoneVerificationRecords()
    {
        // Verification rows hold the phone number in plaintext; deletion has to reach them too.
        var user = NewCompleteUser();
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
        Db.Users.Add(user);
        Db.PhoneVerifications.Add(new PhoneVerification
        {
            Id = Guid.NewGuid(),
            Phone = "99887766",
            Code = "123456",
            ProviderSessionId = "sess-1",
            Status = PhoneVerificationStatus.Verified,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            VerifiedAt = DateTime.UtcNow,
            ClaimedByUserId = user.Id,
            ClaimedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Assert.False(await Db.PhoneVerifications.AnyAsync(v => v.ClaimedByUserId == user.Id));
    }

    [Fact]
    public async Task RunSweepAsync_AnonymizingAUser_PurgesVerificationsTheirOtherIdentitiesClaimed()
    {
        // A returning user's proof is claimed by the anonymous auth identity they signed in with,
        // not by the account id, so a purge keyed on ClaimedByUserId alone left the number behind.
        var phone = Random.Shared.Next(10_000_000, 100_000_000).ToString();
        var user = NewCompleteUser();
        user.PhoneNumber = phone;
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
        Db.Users.Add(user);
        Db.PhoneVerifications.Add(new PhoneVerification
        {
            Id = Guid.NewGuid(),
            Phone = phone,
            Code = "123456",
            ProviderSessionId = "sess-alias",
            Status = PhoneVerificationStatus.Verified,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            VerifiedAt = DateTime.UtcNow,
            ClaimedByUserId = Guid.NewGuid(),
            ClaimedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Assert.False(await Db.PhoneVerifications.AnyAsync(v => v.Phone == phone));
    }

    [Fact]
    public async Task RunSweepAsync_AnonymizingAUser_PurgesTheirPushTokens()
    {
        var user = NewCompleteUser(Guid.NewGuid());
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
        var bystander = NewCompleteUser(Guid.NewGuid());
        Db.Users.AddRange(user, bystander);
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(user.Id);
        var kept = await RegisterPushTokenAsync(bystander.Id);

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.False(await Db.PushTokens.AnyAsync(t => t.UserId == user.Id));
        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == kept));
    }

    [Fact]
    public async Task RunSweepAsync_DropsStaleUnclaimedVerifications_ButKeepsRecentOnes()
    {
        var stale = new PhoneVerification
        {
            Id = Guid.NewGuid(), Phone = "99887711", Code = "111111", ProviderSessionId = "s1",
            Status = PhoneVerificationStatus.Expired, ExpiresAt = DateTime.UtcNow.AddDays(-3),
        };
        var recent = new PhoneVerification
        {
            Id = Guid.NewGuid(), Phone = "99887722", Code = "222222", ProviderSessionId = "s2",
            Status = PhoneVerificationStatus.Pending, ExpiresAt = DateTime.UtcNow.AddMinutes(5),
        };
        Db.PhoneVerifications.AddRange(stale, recent);
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Assert.False(await Db.PhoneVerifications.AnyAsync(v => v.Id == stale.Id));
        Assert.True(await Db.PhoneVerifications.AnyAsync(v => v.Id == recent.Id));
    }
}
