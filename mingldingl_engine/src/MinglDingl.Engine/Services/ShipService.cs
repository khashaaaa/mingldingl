using Microsoft.EntityFrameworkCore;

public class ShipService
{
    private readonly AppDbContext _db;
    private readonly HonourService _honours;
    private readonly ScoreService _score;
    private readonly ConfigService _config;
    private readonly MilestoneService _milestones;
    private readonly PushNotificationService _push;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ILogger<ShipService> _logger;

    public ShipService(AppDbContext db, HonourService honours, ScoreService score, ConfigService config, MilestoneService milestones, PushNotificationService push, SupabaseBroadcastService broadcast, ILogger<ShipService> logger)
    {
        _db = db;
        _honours = honours;
        _score = score;
        _config = config;
        _milestones = milestones;
        _push = push;
        _broadcast = broadcast;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error, string? ErrorCode, string? SlotACode, string? SlotBCode)> CreateAsync(Guid shipperId, string slotAPhone, string slotBPhone)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(slotAPhone, @"^\d{8}$") ||
            !System.Text.RegularExpressions.Regex.IsMatch(slotBPhone, @"^\d{8}$"))
            return (false, "Phone numbers must be 8 digits", "ship.phone_invalid", null, null);

        if (slotAPhone == slotBPhone)
            return (false, "Cannot weave a thread to the same person twice", "ship.duplicate_nominee", null, null);

        var shipper = await _db.Users.FindAsync(shipperId);
        if (shipper is null) return (false, "User not found", "user.not_found", null, null);
        if (shipper.PhoneNumber == slotAPhone || shipper.PhoneNumber == slotBPhone)
            return (false, "Cannot weave a thread to yourself", "ship.self_nominee", null, null);

        var (slotAUserId, slotACode) = await ResolveSlotAsync(slotAPhone, null);
        var (slotBUserId, slotBCode) = await ResolveSlotAsync(slotBPhone, slotACode);

        bool blockedByA = slotAUserId.HasValue &&
            await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == slotAUserId && bl.BlockedId == shipperId);
        bool blockedByB = slotBUserId.HasValue &&
            await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == slotBUserId && bl.BlockedId == shipperId);
        if (blockedByA || blockedByB)
            return (true, null, null, null, null);

        if (slotAUserId.HasValue && slotBUserId.HasValue)
        {
            bool alreadyMatched = await _db.Matches.AnyAsync(m =>
                (m.InitiatorId == slotAUserId && m.ReceiverId == slotBUserId) ||
                (m.InitiatorId == slotBUserId && m.ReceiverId == slotAUserId));
            if (alreadyMatched) return (true, null, null, null, null);
        }

        // Count and insert under one lock on the Weaver. Checking the cap and then adding let two
        // concurrent weaves both read the same count and both pass it, which is also the shape an
        // enumeration of the phone directory would take — the cap is what bounds that.
        int cap = (int)_config.GetNumber("ships.daily.cap", 3);
        var today = DateTime.UtcNow.Date;

        bool underCap = await _db.InTransactionAsync(async () =>
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({DailyCapLockKey(shipperId)})");

            int todayCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.CreatedAt >= today);
            if (todayCount >= cap) return false;

            _db.Ships.Add(new Ship
            {
                ShipperUserId = shipperId,
                // Only for a slot still awaiting its person: once a slot names a user the number
                // has done its job, and a Ship should not sit on a phone number it no longer needs.
                SlotAPhoneNumber = slotAUserId.HasValue ? null : slotAPhone,
                SlotAUserId = slotAUserId,
                SlotAInviteCode = slotACode,
                SlotAOptIn = slotAUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
                SlotBPhoneNumber = slotBUserId.HasValue ? null : slotBPhone,
                SlotBUserId = slotBUserId,
                SlotBInviteCode = slotBCode,
                SlotBOptIn = slotBUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
            });
            await _db.SaveChangesAsync();
            return true;
        });

        if (!underCap) return (false, "Daily thread limit reached", "ship.daily_cap", null, null);
        return (true, null, null, slotACode, slotBCode);
    }

    /// <summary>
    /// A nominee who already has an account is invited in-app and needs no code, so none is minted:
    /// returning one anyway gave the Weaver something to share that could never resolve. The two
    /// slots are resolved in sequence because a freshly generated code is not in the database yet
    /// and so is invisible to <see cref="CodeExistsAsync"/>.
    /// <para>
    /// Known trade-off: a null code therefore tells the Weaver that the number they typed has an
    /// account, which makes this a membership oracle over the phone directory. Closing it would mean
    /// minting a code for every slot — including ones that can never use it — and the app branches on
    /// exactly this null to decide between "share this code" and "we have invited them". It is bounded
    /// instead: <c>ships.daily.cap</c> threads a day is six numbers a day per account, and the count is
    /// taken under a lock in <see cref="CreateAsync"/> so the cap cannot be raced. The code a slot
    /// carries is no longer worth guessing either — <see cref="TryResolveInviteCodeAsync"/> also
    /// requires the redeemer to own the number the code was issued for.
    /// </para>
    /// </summary>
    private async Task<(Guid? UserId, string? InviteCode)> ResolveSlotAsync(string phoneNumber, string? reservedCode)
    {
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber);
        if (existing is not null) return (existing.Id, null);

        string code;
        do
        {
            code = GenerateCode();
        } while (code == reservedCode || await CodeExistsAsync(code));
        return (null, code);
    }

    /// <summary>
    /// Advisory-lock key for one Weaver's daily allowance. Salted so it can never collide with a
    /// <see cref="MatchPairing.PairLockKey"/>, which shares the same lock space.
    /// </summary>
    private static long DailyCapLockKey(Guid shipperId)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            [.. "ship-daily-cap"u8.ToArray(), .. shipperId.ToByteArray()]);
        return BitConverter.ToInt64(hash, 0);
    }

    private static string GenerateCode()
    {
        var chars = new char[6];
        for (int i = 0; i < 6; i++)
            chars[i] = InviteCode.Alphabet[Random.Shared.Next(InviteCode.Alphabet.Length)];
        return new string(chars);
    }

    private async Task<bool> CodeExistsAsync(string code) =>
        await _db.Users.AnyAsync(u => u.ReferralCode == code) ||
        await _db.Ships.AnyAsync(s => s.SlotAInviteCode == code || s.SlotBInviteCode == code);

    /// <summary>
    /// Binds a newly created account into the slot its invite code was issued for. The code alone is
    /// not enough: it used to be a bearer token, so anyone who guessed one — the space is only 31^6,
    /// and <c>GET /public/ship-invite</c> will confirm a guess — or was simply forwarded one could
    /// take a stranger's place in someone else's thread. The number the Weaver nominated has to be
    /// the number this account proved, which is the only thing that makes the slot theirs.
    /// </summary>
    public async Task TryResolveInviteCodeAsync(Guid newUserId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return;
        Ship? ship = null;
        try
        {
            var normalized = code.ToUpperInvariant();
            ship = await _db.Ships.FirstOrDefaultAsync(s =>
                s.Status == "Pending" && (s.SlotAInviteCode == normalized || s.SlotBInviteCode == normalized));
            if (ship is null) return;

            var claimant = await _db.Users.AsNoTracking()
                .Where(u => u.Id == newUserId)
                .Select(u => u.PhoneNumber)
                .FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(claimant)) return;

            bool isSlotA = ship.SlotAInviteCode == normalized;
            var nominated = isSlotA ? ship.SlotAPhoneNumber : ship.SlotBPhoneNumber;
            // Threads woven before the number was recorded have nothing to check against. Refusing
            // them keeps the rule absolute rather than leaving a window that behaves the old way.
            if (nominated is null || nominated != claimant) return;

            if (isSlotA)
            {
                ship.SlotAUserId = newUserId;
                ship.SlotAInviteCode = null;
                ship.SlotAPhoneNumber = null;
                ship.SlotAOptIn = "PendingOptIn";
            }
            else
            {
                ship.SlotBUserId = newUserId;
                ship.SlotBInviteCode = null;
                ship.SlotBPhoneNumber = null;
                ship.SlotBOptIn = "PendingOptIn";
            }
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ship invite-code resolution swallowed a failure for new user {UserId} (code {Code})", newUserId, code);

            // Detach only what this method touched. Clearing the whole tracker would silently
            // throw away unsaved work belonging to whoever else is sharing this scoped context.
            if (ship is not null) _db.Entry(ship).State = EntityState.Detached;
        }
    }

    public async Task<bool> RespondAsync(Guid userId, Guid shipId, bool accept)
    {
        var lookup = await _db.Ships.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shipId);
        if (lookup is null || lookup.Status != "Pending") return false;

        bool isSlotA = lookup.SlotAUserId == userId;
        bool isSlotB = lookup.SlotBUserId == userId;
        if (!isSlotA && !isSlotB) return false;

        string newOptIn = accept ? "Accepted" : "Declined";

        var updated = isSlotA
            ? await _db.Database.SqlQuery<ShipOptInRow>(
                $"""
                UPDATE "Ships" SET "SlotAOptIn" = {newOptIn}
                WHERE "Id" = {shipId} AND "Status" = 'Pending'
                RETURNING "SlotAOptIn", "SlotBOptIn", "SlotAUserId", "SlotBUserId"
                """).ToListAsync()
            : await _db.Database.SqlQuery<ShipOptInRow>(
                $"""
                UPDATE "Ships" SET "SlotBOptIn" = {newOptIn}
                WHERE "Id" = {shipId} AND "Status" = 'Pending'
                RETURNING "SlotAOptIn", "SlotBOptIn", "SlotAUserId", "SlotBUserId"
                """).ToListAsync();
        if (updated.Count == 0) return false;
        var row = updated[0];

        if (row.SlotAOptIn == "Declined" || row.SlotBOptIn == "Declined")
        {
            // Still conditional on Pending: a thread that sparked or expired in the meantime keeps
            // the outcome it reached, rather than being rewritten as Declined after the fact.
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Ships" SET "Status" = 'Declined' WHERE "Id" = {shipId} AND "Status" = 'Pending'""");
            return false;
        }

        if (row.SlotAOptIn != "Accepted" || row.SlotBOptIn != "Accepted")
            return false;

        var slotAUserId = row.SlotAUserId!.Value;
        var slotBUserId = row.SlotBUserId!.Value;
        bool blocked = await MatchPairing.IsPairBlockedAsync(_db, slotAUserId, slotBUserId);
        // A woven thread is the third path that can create a Match, and it was the one that never
        // asked whether the two may be matched at all — so it could pair two people of the same
        // gender, or someone paused, banned or pending deletion, straight past the rule discovery
        // and POST /matches both obey. Checked here rather than at weave time because weeks can
        // pass between the weave and the second acceptance.
        bool eligible = await MatchPairing.AreBothEligibleAsync(_db, slotAUserId, slotBUserId);

        // Claim and match in one transaction, under the same advisory lock the other two
        // match-creating paths take. The claim used to commit on its own first, so a failed insert
        // left the Ship Sparked with no match behind it and nothing that would ever retry it.
        var (matchId, sparked) = await _db.InTransactionAsync(async () =>
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({MatchPairing.PairLockKey(slotAUserId, slotBUserId)})");

            // Somebody else's match, found inside the lock: the thread did not cause it.
            bool alreadyMatched = await MatchPairing.PairAlreadyMatchedAsync(_db, slotAUserId, slotBUserId);
            string terminalStatus = alreadyMatched || blocked || !eligible ? "Expired" : "Sparked";

            // Leaving Pending is the claim, and it is what makes everything below run exactly once.
            // Both slots can observe "both accepted" concurrently — a double-tapped accept on the
            // second slot is enough — and the rest of this method creates a match and pays the Weaver.
            int claimed = await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Ships" SET "Status" = {terminalStatus} WHERE "Id" = {shipId} AND "Status" = 'Pending'""");
            if (claimed == 0 || terminalStatus == "Expired") return ((Guid?)null, false);

            var match = MatchPairing.NewMatch(slotAUserId, slotBUserId, shipId);
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();

            await _db.Ships
                .Where(s => s.Id == shipId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ResultMatchId, (Guid?)match.Id));
            return ((Guid?)match.Id, true);
        });
        if (!sparked) return false;

        await _score.AwardAsync(lookup.ShipperUserId, "ShipSparked");
        var shipperHonour = await GrantMilestoneTitleIfEarnedAsync(lookup.ShipperUserId);
        if (shipperHonour is not null)
        {
            await _db.Ships
                .Where(s => s.Id == shipId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ShipperRewardItemId, shipperHonour.Id));
        }

        await _milestones.AchieveAsync(row.SlotAUserId.Value, "first_match");
        await _milestones.AchieveAsync(row.SlotBUserId.Value, "first_match");

        var sparkData = new Dictionary<string, object> { ["matchId"] = matchId.ToString() };
        await _push.NotifyUserAsync(row.SlotAUserId.Value, PushKind.ThreadSparked, sparkData);
        await _push.NotifyUserAsync(row.SlotBUserId.Value, PushKind.ThreadSparked, sparkData);
        await _broadcast.BroadcastAsync("app-nudges", "match_created",
            new { matchId, userIds = new[] { row.SlotAUserId.Value, row.SlotBUserId.Value }, source = "ship" });

        return true;
    }

    private sealed class ShipOptInRow
    {
        public string SlotAOptIn { get; set; } = "";
        public string SlotBOptIn { get; set; } = "";
        public Guid? SlotAUserId { get; set; }
        public Guid? SlotBUserId { get; set; }
    }

    private static readonly (int Sparks, string ItemId)[] ShipTitles =
    [
        (1, "title_threadweaver"),
        (5, "title_fateseer"),
        (10, "title_bondkeeper"),
    ];

    /// <summary>
    /// Every rung the count has reached, not only the one it landed on exactly. Two threads sparking
    /// at once can both count past a rung — 4 to 6 — and matching on the exact number skipped the
    /// title for good. The grant is once per honour, so revisiting lower rungs gives nothing twice.
    /// </summary>
    private async Task<DroppedItem?> GrantMilestoneTitleIfEarnedAsync(Guid shipperId)
    {
        int sparkedCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.Status == "Sparked");
        DroppedItem? granted = null;
        foreach (var (sparks, itemId) in ShipTitles)
            if (sparkedCount >= sparks && await _honours.GrantAsync(shipperId, itemId, "ShipMilestone") is { } item)
                granted = item;
        return granted;
    }
}
