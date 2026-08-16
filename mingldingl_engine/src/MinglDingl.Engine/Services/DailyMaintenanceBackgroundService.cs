using Microsoft.EntityFrameworkCore;

// Runs the sweeps that were previously only lazy/client-triggered:
// ghosting matches with a stale last message, resetting each user's daily
// match budget, and (added 2026-07-28) anonymizing accounts whose 7-day
// deletion grace period has passed. None of these depend on a specific
// client ever calling in.
public class DailyMaintenanceBackgroundService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);
    private static readonly TimeSpan DeletionGracePeriod = TimeSpan.FromDays(7);
    private static readonly TimeSpan ShipExpiryPeriod = TimeSpan.FromDays(14);

    // Exposed for AdminUsersController's deletion-requests view (days
    // remaining until this sweep auto-anonymizes) instead of a second
    // hardcoded "7" living in two places.
    public static TimeSpan GracePeriod => DeletionGracePeriod;

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

        // Batch the whole sweep: one query for candidates, one penalty award
        // covering every ghosted match, one save for status + reset changes —
        // instead of a per-match CheckAsync round trip (query+2 awards+save each).
        var staleMatches = await db.Matches
            .Where(m => m.Status == "Active" && m.LastMessageAt != null)
            .ToListAsync(ct);
        var ghostedMatches = staleMatches.Where(GhostingService.IsStale).ToList();
        foreach (var match in ghostedMatches)
            match.Status = "Ghosted";
        if (ghostedMatches.Count > 0)
        {
            await score.AwardManyAsync(ghostedMatches
                .Select(GhostingService.GetGhostAtFaultUserId)
                .Where(id => id.HasValue)
                .Select(id => (id!.Value, "GhostPenalty")));
        }

        var today = DateTime.UtcNow.Date;
        var usersNeedingReset = await db.Users
            .Where(u => u.DailyMatchesResetAt < today)
            .ToListAsync(ct);
        foreach (var user in usersNeedingReset)
        {
            user.DailyMatchesUsed = 0;
            user.DailyMatchesResetAt = today;
        }

        // Anonymize (never hard-delete — the row stays so existing
        // matches/messages don't break, see PartialUserProfile.IsDeleted)
        // anyone whose 7-day grace period has passed. DeletionRequestedAt is
        // left set as a permanent marker; UsersController.GetMe's auto-cancel
        // only fires while IsDeleted is still false.
        var deletionCutoff = DateTime.UtcNow - DeletionGracePeriod;
        var usersToAnonymize = await db.Users
            .Where(u => u.DeletionRequestedAt != null && u.DeletionRequestedAt < deletionCutoff && !u.IsDeleted)
            .ToListAsync(ct);
        foreach (var user in usersToAnonymize)
        {
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
            user.IsDeleted = true;
        }

        // Auto-downgrade lapsed paid memberships (2026-07-28). A soft, static
        // predicate check over an already-materialized list, same shape as
        // the ghosting pass above — cheaper than translating it into SQL for
        // a table this size, and keeps the predicate itself unit-testable in
        // isolation (MembershipExpiryTests).
        var now = DateTime.UtcNow;
        var candidateMemberships = await db.Users
            .Where(u => u.MembershipLevel != "Free" && u.MembershipExpiresAt != null)
            .ToListAsync(ct);
        var expiredMemberships = candidateMemberships.Where(u => MembershipExpiry.HasExpired(u, now)).ToList();
        foreach (var user in expiredMemberships)
        {
            user.MembershipLevel = "Free";
            user.MembershipExpiresAt = null;
        }

        var shipExpiryCutoff = DateTime.UtcNow - ShipExpiryPeriod;
        var expiredShips = await db.Ships
            .Where(s => s.Status == "Pending" && s.CreatedAt < shipExpiryCutoff)
            .ToListAsync(ct);
        foreach (var ship in expiredShips)
            ship.Status = "Expired";

        if (ghostedMatches.Count > 0 || usersNeedingReset.Count > 0 || usersToAnonymize.Count > 0 || expiredMemberships.Count > 0 || expiredShips.Count > 0)
            await db.SaveChangesAsync(ct);
    }
}
