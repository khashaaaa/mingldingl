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
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        // `silent` answered once and then stopped, which is what makes them the ghost. Without the
        // rows this is a one-sided approach and carries no penalty at all.
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = silent.Id, Content = "hello" });
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
        var user = NewCompleteUser();
        // The path POST /photos/upload issues: a file only counts as this user's own when it is in
        // the directory they were given, so the sweep can never reach into another account's files.
        var url = await storage.UploadAsync(
            LocalFileStorageService.PhotoBucket,
            $"{LocalFileStorageService.ProfilePhotoDirectory(user.Id)}a.jpg",
            [1, 2, 3],
            "image/jpeg");
        user.PhotoUrls = [url];
        user.DeletionRequestedAt = DateTime.UtcNow - DailyMaintenanceBackgroundService.GracePeriodFor(new ConfigService()) - TimeSpan.FromDays(1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await BuildService(storage).RunSweepAsync(CancellationToken.None);

        Assert.False(storage.DeleteByPublicUrl(url), "the file should already be gone");
        Assert.Empty((await Db.Users.FindAsync(user.Id))!.PhotoUrls);
    }

    /// <summary>
    /// An upload is issued the moment a photo is picked and only lands on a row when the profile is
    /// saved, so every abandoned edit and failed save left a permanently public file behind and
    /// nothing bounded the disk.
    /// </summary>
    [Fact]
    public async Task RunSweepAsync_DeletesAnUploadedFileNoRowEverPointedAt()
    {
        var storage = BuildTestStorage();
        var owner = NewCompleteUser();
        var orphan = await storage.UploadAsync(
            LocalFileStorageService.PhotoBucket,
            $"{LocalFileStorageService.ProfilePhotoDirectory(owner.Id)}abandoned.jpg",
            [1, 2, 3], "image/jpeg");
        AgeFile(storage, orphan);
        owner.PhotoUrls = [];
        Db.Users.Add(owner);
        await Db.SaveChangesAsync();

        await BuildService(storage).RunSweepAsync(CancellationToken.None);

        Assert.False(storage.DeleteByPublicUrl(orphan), "the orphan should already be gone");
    }

    [Fact]
    public async Task RunSweepAsync_LeavesAnUploadYoungerThanTheGracePeriodAlone()
    {
        var storage = BuildTestStorage();
        var owner = NewCompleteUser();
        var justUploaded = await storage.UploadAsync(
            LocalFileStorageService.PhotoBucket,
            $"{LocalFileStorageService.ProfilePhotoDirectory(owner.Id)}mid-edit.jpg",
            [1, 2, 3], "image/jpeg");
        owner.PhotoUrls = [];
        Db.Users.Add(owner);
        await Db.SaveChangesAsync();

        await BuildService(storage).RunSweepAsync(CancellationToken.None);

        // Someone is in the middle of editing their profile right now.
        Assert.True(storage.DeleteByPublicUrl(justUploaded));
    }

    /// <summary>
    /// The trap this sweep has to avoid. Storage:PublicBaseUrl differs between localhost, the LAN
    /// IP used for device testing and production, so comparing full URLs would read a live photo
    /// recorded under an older origin as an orphan and delete it.
    /// </summary>
    [Fact]
    public async Task RunSweepAsync_KeepsAReferencedPhotoRecordedUnderAnOlderOrigin()
    {
        var storage = BuildTestStorage();
        var owner = NewCompleteUser();
        var url = await storage.UploadAsync(
            LocalFileStorageService.PhotoBucket,
            $"{LocalFileStorageService.ProfilePhotoDirectory(owner.Id)}kept.jpg",
            [1, 2, 3], "image/jpeg");
        AgeFile(storage, url);
        owner.PhotoUrls = [url.Replace("http://localhost:5150", "http://192.168.1.32:5150")];
        Db.Users.Add(owner);
        await Db.SaveChangesAsync();

        await BuildService(storage).RunSweepAsync(CancellationToken.None);

        Assert.True(storage.DeleteByPublicUrl(url), "a live photo must survive the orphan sweep");
    }

    /// <summary>Backdates a stored file past the sweep's 24h grace period.</summary>
    private static void AgeFile(LocalFileStorageService storage, string url)
    {
        var relative = storage.RelativePathOf(url)!;
        var path = Path.Combine(RootOf(storage), relative.Replace('/', Path.DirectorySeparatorChar));
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddDays(-3));
    }

    /// <summary>The uploads root the service was constructed with; nothing else exposes it.</summary>
    private static string RootOf(LocalFileStorageService storage) =>
        (string)typeof(LocalFileStorageService)
            .GetField("_root", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
            .GetValue(storage)!;

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

    /// <summary>
    /// The hourly sweep is the path that actually ghosts matches in production; the on-demand
    /// ghost-check is the rare one. It had its own batched copy of the at-fault rule, so fixing
    /// only GhostingService.CheckAsync left the exploit fully open here.
    /// </summary>
    [Fact]
    public async Task RunSweepAsync_RecipientNeverSentAMessage_GhostsWithoutPenalisingThem()
    {
        var approacher = NewCompleteUser();
        var recipient = NewCompleteUser();
        recipient.TotalScore = 100;
        recipient.ReputationScore = 1.0m;
        Db.Users.AddRange(approacher, recipient);
        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = approacher.Id,
            ReceiverId = recipient.Id,
            Status = "Active",
            MessageCount = 1,
            InitiatorMessageCount = 1,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = approacher.Id,
        };
        Db.Matches.Add(match);
        Db.Messages.Add(new Message
        {
            Id = Guid.NewGuid(), MatchId = match.Id, SenderId = approacher.Id, Content = "hey",
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var after = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == recipient.Id);
        Assert.Equal("Ghosted", (await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id)).Status);
        Assert.Equal(100, after.TotalScore);
        Assert.Equal(1.0m, after.ReputationScore);
    }

    [Fact]
    public async Task RunSweepAsync_SomeoneWhoSpokeThenStopped_IsStillPenalised()
    {
        var replier = NewCompleteUser();
        var abandoner = NewCompleteUser();
        abandoner.TotalScore = 100;
        Db.Users.AddRange(replier, abandoner);
        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = abandoner.Id,
            Status = "Active",
            MessageCount = 2,
            InitiatorMessageCount = 1,
            ReceiverMessageCount = 1,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = abandoner.Id, Content = "hello" });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.Equal(85, (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == abandoner.Id)).TotalScore);
    }
}
