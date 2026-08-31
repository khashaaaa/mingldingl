using Microsoft.EntityFrameworkCore;

public class DailyMaintenanceBackgroundService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);
    private static readonly TimeSpan DeletionGracePeriod = TimeSpan.FromDays(7);
    private static readonly TimeSpan ShipExpiryPeriod = TimeSpan.FromDays(14);

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
        var oaths = scope.ServiceProvider.GetRequiredService<OathService>();
        var ghosting = scope.ServiceProvider.GetRequiredService<GhostingService>();

        var staleMatches = await db.Matches
            .Where(m => m.Status == "Active" && m.LastMessageAt != null)
            .ToListAsync(ct);

        var ghostedMatches = new List<Match>();
        foreach (var match in staleMatches.Where(GhostingService.IsStale))
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
        var usersNeedingReset = await db.Users
            .Where(u => u.DailyMatchesResetAt < today)
            .ToListAsync(ct);
        foreach (var user in usersNeedingReset)
        {
            user.DailyMatchesUsed = 0;
            user.DailyMatchesResetAt = today;
        }

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
            user.Oath = null;
            user.OathSwornAt = null;
            user.OathProven = false;
            user.IsDeleted = true;
        }

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

        foreach (var match in ghostedMatches)
            await ghosting.BroadcastGhostedAsync(match.Id, GhostingService.GetGhostAtFaultUserId(match));

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
