using Microsoft.EntityFrameworkCore;

public class DailyMaintenanceBackgroundService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);
    private static readonly TimeSpan VerificationRetention = TimeSpan.FromDays(1);

    public static TimeSpan GracePeriodFor(ConfigService config) =>
        TimeSpan.FromDays(Math.Max(0, config.GetNumber("account.deletion_grace_days", 7)));

    public static TimeSpan ShipExpiryFor(ConfigService config) =>
        TimeSpan.FromDays(Math.Max(1, config.GetNumber("ships.expiry_days", 14)));

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailyMaintenanceBackgroundService> _logger;

    public DailyMaintenanceBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<DailyMaintenanceBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunSweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Daily maintenance sweep failed");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }

    internal async Task RunSweepAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var score = scope.ServiceProvider.GetRequiredService<ScoreService>();
        var oaths = scope.ServiceProvider.GetRequiredService<OathService>();
        var ghosting = scope.ServiceProvider.GetRequiredService<GhostingService>();
        var storage = scope.ServiceProvider.GetRequiredService<LocalFileStorageService>();
        var config = scope.ServiceProvider.GetRequiredService<ConfigService>();

        // Push the staleness cutoff into SQL — this used to pull the whole active-match table
        // into memory every hour just to filter it on LastMessageAt.
        var staleCutoff = DateTime.UtcNow - ghosting.StaleAfter;
        var staleMatches = await db.Matches
            .Where(m => m.Status == "Active" && m.LastMessageAt != null && m.LastMessageAt < staleCutoff)
            .ToListAsync(ct);

        var ghostedMatches = new List<Match>();
        foreach (var match in staleMatches)
            if (await ghosting.TryGhostAsync(match))
                ghostedMatches.Add(match);
        if (ghostedMatches.Count > 0)
        {
            await score.AwardManyAsync(ghostedMatches
                .Select(GhostingService.GetGhostAtFaultUserId)
                .Where(id => id.HasValue)
                .Select(id => (id!.Value, "GhostPenalty")));
        }

        var ghostOathRefreshIds = ghostedMatches
            .Select(GhostingService.GetGhostAtFaultUserId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var today = DateTime.UtcNow.Date;
        var usersReset = await db.Users
            .Where(u => u.DailyMatchesResetAt < today)
            .ExecuteUpdateAsync(
                s => s.SetProperty(u => u.DailyMatchesUsed, 0).SetProperty(u => u.DailyMatchesResetAt, today),
                ct);

        var deletionCutoff = DateTime.UtcNow - GracePeriodFor(config);
        var usersToAnonymize = await db.Users
            .Where(u => u.DeletionRequestedAt != null && u.DeletionRequestedAt < deletionCutoff && !u.IsDeleted)
            .ToListAsync(ct);
        // Captured before the loop clears the column: a returning user's proofs are claimed by the
        // anonymous auth identity they signed in with, not by the account id, so the purge below
        // has to reach verification rows by number as well.
        var anonymizedPhones = usersToAnonymize
            .Where(u => u.PhoneNumber is not null)
            .Select(u => u.PhoneNumber!)
            .ToList();
        foreach (var user in usersToAnonymize)
        {
            // Clearing the column is not deletion: /uploads is public and unauthenticated, so the
            // files have to go too or anyone holding an old URL keeps access after deletion.
            foreach (var photoUrl in user.PhotoUrls)
                storage.DeleteByPublicUrl(photoUrl);

            user.DisplayName = "";
            user.Bio = "";
            user.PhotoUrls = [];
            user.City = "";
            user.Latitude = null;
            user.Longitude = null;
            user.HasKids = null;
            user.SmokingHabit = null;
            user.DrinkingHabit = null;
            user.Religion = null;
            user.Lifestyle = null;
            user.EquippedFrameId = null;
            user.EquippedTitleId = null;
            user.PhoneNumber = null;
            user.ReferralCode = null;
            user.Oath = null;
            user.OathSwornAt = null;
            user.OathProven = false;
            user.IsDeleted = true;
        }

        if (usersToAnonymize.Count > 0)
        {
            // Verification rows hold the phone number in plaintext; deletion has to reach them too.
            var anonymizedIds = usersToAnonymize.Select(u => u.Id).ToList();
            await db.PhoneVerifications
                .Where(v => (v.ClaimedByUserId != null && anonymizedIds.Contains(v.ClaimedByUserId.Value))
                    || anonymizedPhones.Contains(v.Phone))
                .ExecuteDeleteAsync(ct);
            // A push token is a live handle to the person's device; a deleted account keeps none.
            await db.PushTokens
                .Where(t => anonymizedIds.Contains(t.UserId))
                .ExecuteDeleteAsync(ct);
        }

        // Unclaimed verifications are short-lived proof-of-ownership records with no purpose
        // once expired, so they are not retained either.
        await db.PhoneVerifications
            .Where(v => v.ClaimedByUserId == null && v.ExpiresAt < DateTime.UtcNow - VerificationRetention)
            .ExecuteDeleteAsync(ct);

        var now = DateTime.UtcNow;
        var expiredMemberships = await db.Users
            .Where(u => u.MembershipLevel != "Free" && u.MembershipExpiresAt != null && u.MembershipExpiresAt < now)
            .ExecuteUpdateAsync(
                s => s.SetProperty(u => u.MembershipLevel, "Free").SetProperty(u => u.MembershipExpiresAt, (DateTime?)null),
                ct);

        var shipExpiryCutoff = DateTime.UtcNow - ShipExpiryFor(config);
        var expiredShips = await db.Ships
            .Where(s => s.Status == "Pending" && s.CreatedAt < shipExpiryCutoff)
            .ToListAsync(ct);
        foreach (var ship in expiredShips)
            ship.Status = "Expired";

        if (ghostedMatches.Count > 0 || usersToAnonymize.Count > 0 || expiredShips.Count > 0)
            await db.SaveChangesAsync(ct);

        if (usersReset > 0 || expiredMemberships > 0)
            _logger.LogInformation(
                "Sweep reset {Reset} daily budgets and expired {Memberships} memberships", usersReset, expiredMemberships);

        foreach (var match in ghostedMatches)
        {
            await ghosting.BroadcastGhostedAsync(match.Id, GhostingService.GetGhostAtFaultUserId(match));
            await ghosting.NotifyGhostedAsync(match);
        }

        foreach (var userId in ghostOathRefreshIds)
        {
            try
            {
                await oaths.RefreshAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to refresh oath state for user {UserId} after ghost sweep", userId);
            }
        }
    }
}
