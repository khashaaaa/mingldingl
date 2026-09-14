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
        // Both of IsStale's clocks, or a match nobody ever spoke in never came back here at all.
        var unansweredCutoff = DateTime.UtcNow - ghosting.UnansweredAfter;
        var staleMatches = await db.Matches
            .AsNoTracking()
            .Where(m => m.Status == "Active" && (
                m.LastMessageAt != null
                    ? m.LastMessageAt < staleCutoff
                    : m.CreatedAt < unansweredCutoff))
            .ToListAsync(ct);

        // Each match is ghosted and its penalty paid in one transaction of its own, resolved through
        // the same rule the on-demand ghost-check uses: someone who never sent a message into a match
        // they did not ask for has not ghosted anyone. A match that fails rolls back to Active and
        // the next sweep retries it; it no longer takes the rest of the pass down with it.
        var ghostedMatches = new List<Match>();
        var atFaultByMatch = new Dictionary<Guid, Guid>();
        foreach (var match in staleMatches)
        {
            try
            {
                var (ghosted, atFault) = await ghosting.GhostAndPenaliseAsync(match);
                if (!ghosted) continue;
                ghostedMatches.Add(match);
                if (atFault is Guid id) atFaultByMatch[match.Id] = id;
            }
            catch (Exception ex)
            {
                // Whatever the failed attempt queued would otherwise ride along on the next save.
                db.ChangeTracker.Clear();
                _logger.LogWarning(ex, "Could not ghost match {MatchId}; the next sweep retries it", match.Id);
            }
        }

        var ghostOathRefreshIds = atFaultByMatch.Values.Distinct().ToList();

        var today = DateTime.UtcNow.Date;
        var usersReset = await db.Users
            .Where(u => u.DailyMatchesResetAt < today)
            .ExecuteUpdateAsync(
                s => s.SetProperty(u => u.DailyMatchesUsed, 0).SetProperty(u => u.DailyMatchesResetAt, today),
                ct);

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

        // One statement, so the Pending check and the write cannot be split: loading the ships and
        // saving them later overwrote a thread that sparked in between with Expired.
        var shipExpiryCutoff = DateTime.UtcNow - ShipExpiryFor(config);
        await db.Ships
            .Where(s => s.Status == "Pending" && s.CreatedAt < shipExpiryCutoff)
            .ExecuteUpdateAsync(setters => setters.SetProperty(s => s.Status, "Expired"), ct);

        var deletionCutoff = DateTime.UtcNow - GracePeriodFor(config);
        var photoUrlsToUnlink = new List<string>();
        bool anyDeletionDue = await db.Users.AnyAsync(
            u => u.DeletionRequestedAt != null && u.DeletionRequestedAt < deletionCutoff && !u.IsDeleted, ct);
        // One transaction over the anonymisation and the set-based purges that belong to the same
        // deletions. They used to run as separate statements ahead of the save, so a failure
        // part-way through destroyed a person's verification rows and push tokens while their
        // account stayed un-anonymised.
        if (anyDeletionDue)
        {
            photoUrlsToUnlink = await db.InTransactionAsync(async () =>
            {
                // Read under row locks, and the rows re-read inside the write's own transaction. The
                // list used to be loaded long before the save, so someone who cancelled their
                // deletion in that gap was still anonymised — the one thing here that cannot be
                // undone. A cancel that commits first is no longer selected; one that arrives later
                // waits for this to finish.
                var due = await db.Users
                    .FromSql($"""
                        SELECT * FROM "Users"
                        WHERE "DeletionRequestedAt" IS NOT NULL AND "DeletionRequestedAt" < {deletionCutoff} AND NOT "IsDeleted"
                        FOR UPDATE
                        """)
                    .AsNoTracking()
                    .ToListAsync(ct);

                var anonymizedIds = due.Select(u => u.Id).ToList();
                // Captured before the columns are cleared: a returning user's proofs are claimed by
                // the anonymous auth identity they signed in with, not by the account id, so the
                // purge below has to reach verification rows by number as well.
                var anonymizedPhones = due.Where(u => u.PhoneNumber is not null).Select(u => u.PhoneNumber!).ToList();
                // Clearing the column is not deletion: /uploads is public and unauthenticated, so the
                // files have to go too. Only files the user actually owns — a stolen URL sitting on a
                // row from before that was checked would otherwise let one account's deletion destroy
                // another account's photo — and only for the accounts this transaction anonymised.
                var urls = due.SelectMany(u => u.PhotoUrls.Where(url => storage.IsOwnedPublicUrl(url, u.Id))).ToList();

                foreach (var locked in due)
                {
                    var user = db.Users.Local.FirstOrDefault(u => u.Id == locked.Id) ?? db.Users.Attach(locked).Entity;
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
                    user.EquippedTitleId = null;
                    user.PhoneNumber = null;
                    user.ReferralCode = null;
                    user.Oath = null;
                    user.OathSwornAt = null;
                    user.OathProven = false;
                    user.IsDeleted = true;
                }
                await db.SaveChangesAsync(ct);

                if (anonymizedIds.Count > 0)
                {
                    // Verification rows hold the phone number in plaintext; deletion has to reach them too.
                    await db.PhoneVerifications
                        .Where(v => (v.ClaimedByUserId != null && anonymizedIds.Contains(v.ClaimedByUserId.Value))
                            || anonymizedPhones.Contains(v.Phone))
                        .ExecuteDeleteAsync(ct);
                    // A push token is a live handle to the person's device; a deleted account keeps none.
                    await db.PushTokens
                        .Where(t => anonymizedIds.Contains(t.UserId))
                        .ExecuteDeleteAsync(ct);
                    // A woven thread holds the nominated number until that person signs up, so it
                    // is another plaintext copy deletion has to reach. The slot keeps its code and
                    // simply stops being redeemable, which is the right outcome for an invitation
                    // to an account that no longer exists.
                    await db.Ships
                        .Where(sh => sh.SlotAPhoneNumber != null && anonymizedPhones.Contains(sh.SlotAPhoneNumber))
                        .ExecuteUpdateAsync(setters => setters.SetProperty(sh => sh.SlotAPhoneNumber, (string?)null), ct);
                    await db.Ships
                        .Where(sh => sh.SlotBPhoneNumber != null && anonymizedPhones.Contains(sh.SlotBPhoneNumber))
                        .ExecuteUpdateAsync(setters => setters.SetProperty(sh => sh.SlotBPhoneNumber, (string?)null), ct);
                }
                return urls;
            }, ct);
        }

        // Only now that the anonymisation is durable. DeleteByPublicUrl never throws.
        foreach (var photoUrl in photoUrlsToUnlink)
            storage.DeleteByPublicUrl(photoUrl);

        if (usersReset > 0 || expiredMemberships > 0)
            _logger.LogInformation(
                "Sweep reset {Reset} daily budgets and expired {Memberships} memberships", usersReset, expiredMemberships);

        foreach (var match in ghostedMatches)
        {
            var atFault = atFaultByMatch.TryGetValue(match.Id, out var id) ? id : (Guid?)null;
            await ghosting.BroadcastGhostedAsync(match, atFault);
            await ghosting.NotifyGhostedAsync(match, atFault);
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

        await PruneOrphanedPhotosAsync(db, storage, ct);
        await BackfillSealedPhotosAsync(storage, scope.ServiceProvider.GetRequiredService<SealedPhotoService>(), ct);
    }

    /// <summary>
    /// How long an uploaded file may sit unreferenced before it is treated as abandoned. An upload
    /// is issued as soon as a photo is picked and only lands on a row when the profile is saved, so
    /// the window has to comfortably outlast one editing session — but not longer, because until it
    /// closes the file is fetchable by anyone on a public, unauthenticated path.
    /// </summary>
    private static readonly TimeSpan OrphanGracePeriod = TimeSpan.FromHours(24);

    /// <summary>
    /// Deletes stored profile photos no row points at. Without this, every abandoned edit, failed
    /// save and photo removed before saving left a permanently public file behind, and nothing
    /// bounded the disk.
    /// </summary>
    private async Task PruneOrphanedPhotosAsync(AppDbContext db, LocalFileStorageService storage, CancellationToken ct)
    {
        var stored = storage.EnumerateProfilePhotos();
        if (stored.Count == 0) return;

        // Every table that can point at an uploaded file. Missing one would make this sweep delete
        // live photos, so it is compared on relative paths — the two sides can carry different
        // origins — and built before anything is deleted.
        var referenced = new HashSet<string>(StringComparer.Ordinal);
        void Reference(string? url)
        {
            if (storage.RelativePathOf(url) is { } relative) referenced.Add(relative);
        }

        foreach (var urls in await db.Users.AsNoTracking().Select(u => u.PhotoUrls).ToListAsync(ct))
            foreach (var url in urls) Reference(url);
        foreach (var urls in await db.BusinessPartners.AsNoTracking().Select(b => b.PhotoUrls).ToListAsync(ct))
            foreach (var url in urls) Reference(url);
        foreach (var url in await db.BusinessRatings.AsNoTracking()
            .Where(r => r.PhotoUrl != null).Select(r => r.PhotoUrl!).ToListAsync(ct))
            Reference(url);

        var cutoff = DateTime.UtcNow - OrphanGracePeriod;
        int deleted = 0;
        foreach (var (relativePath, lastWriteUtc) in stored)
        {
            if (ct.IsCancellationRequested) break;

            if (LocalFileStorageService.IsSealedPath(relativePath))
            {
                // Null for a legacy-named sealed file or one whose original is gone: never kept.
                var originalOfSealed = storage.OriginalPathOfSealed(relativePath);
                // No row ever references a sealed URL — SealedPhotoUrl is derived on read, never
                // stored — so comparing a sealed file against `referenced` directly deleted every
                // sealed file the sweep itself had just made, the moment its own grace period
                // passed. It is owned by its original instead: the same young-file grace applies
                // (a freshly-backfilled sealed file must survive this same pass), but the
                // reference check asks whether the *original* is referenced, not the sealed file
                // itself — so an abandoned original and its sealed sibling are pruned together.
                if (lastWriteUtc > cutoff || (originalOfSealed is not null && referenced.Contains(originalOfSealed))) continue;
                if (storage.DeleteByRelativePath(relativePath)) deleted++;
                continue;
            }

            if (lastWriteUtc > cutoff || referenced.Contains(relativePath)) continue;
            if (storage.DeleteByRelativePath(relativePath)) deleted++;
        }

        if (deleted > 0) _logger.LogInformation("Sweep deleted {Count} orphaned photo files", deleted);
    }

    /// <summary>Sealed variants created per sweep, bounded so a backlog of pre-feature photos can't turn one sweep into a long-running image-processing job.</summary>
    private const int MaxSealedBackfillPerSweep = 200;

    /// <summary>
    /// Every profile photo uploaded before sealing existed (or whose upload-time seal failed) has
    /// no sealed sibling yet, and the candidate feed shows nothing for one until it does. This
    /// walks stored photos and produces the missing variants a bounded number at a time; a
    /// corrupt or unreadable original is logged and skipped rather than stopping the sweep.
    /// </summary>
    private async Task BackfillSealedPhotosAsync(LocalFileStorageService storage, SealedPhotoService sealedPhotos, CancellationToken ct)
    {
        int created = 0;
        foreach (var (relativePath, _) in storage.EnumerateProfilePhotos())
        {
            if (ct.IsCancellationRequested || created >= MaxSealedBackfillPerSweep) break;
            // A sealed file is never itself sealed, and already-sealed originals are skipped below.
            if (LocalFileStorageService.IsSealedPath(relativePath)) continue;
            if (storage.SealedVariantExists(relativePath)) continue;

            try
            {
                await sealedPhotos.SealAsync(relativePath);
                created++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not create sealed variant for {Path}", relativePath);
            }
        }

        if (created > 0) _logger.LogInformation("Sweep created {Count} sealed photo variants", created);
    }
}
