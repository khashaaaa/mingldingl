using Microsoft.EntityFrameworkCore;

public class ShipService
{
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly AppDbContext _db;
    private readonly LootService _loot;
    private readonly ScoreService _score;
    private readonly ConfigService _config;
    private readonly MilestoneService _milestones;
    private readonly PushNotificationService _push;

    public ShipService(AppDbContext db, LootService loot, ScoreService score, ConfigService config, MilestoneService milestones, PushNotificationService push)
    {
        _db = db;
        _loot = loot;
        _score = score;
        _config = config;
        _milestones = milestones;
        _push = push;
    }

    public async Task<(bool Success, string? Error, string? SlotACode, string? SlotBCode)> CreateAsync(Guid shipperId, string slotAPhone, string slotBPhone)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(slotAPhone, @"^\d{8}$") ||
            !System.Text.RegularExpressions.Regex.IsMatch(slotBPhone, @"^\d{8}$"))
            return (false, "Phone numbers must be 8 digits", null, null);

        // A dead-end ship (no match possible, unclearable prompt loop for
        // whoever's on the other end) — reject before any resolution work.
        if (slotAPhone == slotBPhone)
            return (false, "Cannot weave a thread to the same person twice", null, null);

        var shipper = await _db.Users.FindAsync(shipperId);
        if (shipper is null) return (false, "User not found", null, null);
        if (shipper.PhoneNumber == slotAPhone || shipper.PhoneNumber == slotBPhone)
            return (false, "Cannot weave a thread to yourself", null, null);

        int cap = (int)_config.GetNumber("ships.daily.cap", 3);
        var today = DateTime.UtcNow.Date;
        int todayCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.CreatedAt >= today);
        if (todayCount >= cap) return (false, "Daily thread limit reached", null, null);

        var (slotAUserId, slotACode) = await ResolveSlotAsync(slotAPhone);
        var (slotBUserId, slotBCode) = await ResolveSlotAsync(slotBPhone);

        // Privacy-preserving no-ops below: the Weaver must never be able to
        // tell, from the response, that a slot resolved to a real account
        // that has blocked them, or that the pair is already matched — both
        // outcomes return the exact same success + codes shape as a real
        // thread, just without a Ship row ever existing server-side.
        bool blockedByA = slotAUserId.HasValue &&
            await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == slotAUserId && bl.BlockedId == shipperId);
        bool blockedByB = slotBUserId.HasValue &&
            await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == slotBUserId && bl.BlockedId == shipperId);
        if (blockedByA || blockedByB)
            return (true, null, slotACode, slotBCode);

        if (slotAUserId.HasValue && slotBUserId.HasValue)
        {
            bool alreadyMatched = await _db.Matches.AnyAsync(m =>
                (m.InitiatorId == slotAUserId && m.ReceiverId == slotBUserId) ||
                (m.InitiatorId == slotBUserId && m.ReceiverId == slotAUserId));
            if (alreadyMatched) return (true, null, slotACode, slotBCode);
        }

        _db.Ships.Add(new Ship
        {
            ShipperUserId = shipperId,
            SlotAUserId = slotAUserId,
            SlotAInviteCode = slotAUserId.HasValue ? null : slotACode,
            SlotAOptIn = slotAUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
            SlotBUserId = slotBUserId,
            SlotBInviteCode = slotBUserId.HasValue ? null : slotBCode,
            SlotBOptIn = slotBUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
        });
        await _db.SaveChangesAsync();
        return (true, null, slotACode, slotBCode);
    }

    // A code is generated for every slot regardless of resolution — an
    // already-registered slot never needs its code to actually resolve
    // anything (GET /ships/pending finds them directly), but the Weaver's
    // response has to carry one anyway so both branches look identical and
    // so both cost the same DB round trips (no timing side-channel between
    // "known number" and "unknown number").
    private async Task<(Guid? UserId, string InviteCode)> ResolveSlotAsync(string phoneNumber)
    {
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber);

        string code;
        do
        {
            code = GenerateCode();
        } while (await CodeExistsAsync(code));
        return (existing?.Id, code);
    }

    private static string GenerateCode()
    {
        var chars = new char[6];
        for (int i = 0; i < 6; i++)
            chars[i] = CodeAlphabet[Random.Shared.Next(CodeAlphabet.Length)];
        return new string(chars);
    }

    // Shared code namespace with ReferralService.GetOrCreateCodeAsync — see
    // the Fated Threads spec's "Code namespace" note. A referral code and a
    // ship invite code must never collide, since onboarding's single code
    // field resolves both without knowing in advance which table it's in.
    private async Task<bool> CodeExistsAsync(string code) =>
        await _db.Users.AnyAsync(u => u.ReferralCode == code) ||
        await _db.Ships.AnyAsync(s => s.SlotAInviteCode == code || s.SlotBInviteCode == code);

    // Called from UsersController.Upsert alongside ReferralService's own
    // code check — at most one of the two will ever match a given code,
    // since the namespace above is shared and unique. Best-effort by
    // design, mirrors ReferralService.TryCompleteReferralAsync's own
    // try/catch — a failure here must never fail the onboarding submission
    // this is called from.
    public async Task TryResolveInviteCodeAsync(Guid newUserId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return;
        try
        {
            var normalized = code.ToUpperInvariant();
            var ship = await _db.Ships.FirstOrDefaultAsync(s =>
                s.Status == "Pending" && (s.SlotAInviteCode == normalized || s.SlotBInviteCode == normalized));
            if (ship is null) return;

            if (ship.SlotAInviteCode == normalized)
            {
                ship.SlotAUserId = newUserId;
                ship.SlotAInviteCode = null;
                ship.SlotAOptIn = "PendingOptIn";
            }
            else
            {
                ship.SlotBUserId = newUserId;
                ship.SlotBInviteCode = null;
                ship.SlotBOptIn = "PendingOptIn";
            }
            await _db.SaveChangesAsync();
        }
        catch
        {
            _db.ChangeTracker.Clear();
        }
    }

    // Returns true only when this specific response is the one that sparked
    // the match (both slots now Accepted) — false for every other outcome
    // (recorded but not yet complete, declined, not found, not a
    // participant, already responded). The caller (ShipsController) treats
    // all of those uniformly; see the spec's privacy constraint.
    public async Task<bool> RespondAsync(Guid userId, Guid shipId, bool accept)
    {
        var lookup = await _db.Ships.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shipId);
        if (lookup is null || lookup.Status != "Pending") return false;

        bool isSlotA = lookup.SlotAUserId == userId;
        bool isSlotB = lookup.SlotBUserId == userId;
        if (!isSlotA && !isSlotB) return false;

        string newOptIn = accept ? "Accepted" : "Declined";

        // Atomic conditional UPDATE ... RETURNING: sets this caller's slot and
        // reads back the row's just-committed state (including the OTHER
        // slot's value) in the same statement, re-checking Status = 'Pending'
        // in the WHERE clause. Two concurrent responses to the same ship (one
        // per slot) used to each check the other slot against their own stale
        // in-memory snapshot, so neither ever observed "both Accepted" even
        // though both values landed in the row — Postgres's row lock now
        // serializes the two UPDATEs, so whichever commits second is
        // guaranteed to read the first's already-committed value back.
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
        if (updated.Count == 0) return false; // ship resolved concurrently since the read above
        var row = updated[0];

        if (row.SlotAOptIn == "Declined" || row.SlotBOptIn == "Declined")
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Ships" SET "Status" = 'Declined' WHERE "Id" = {shipId}""");
            return false;
        }

        if (row.SlotAOptIn != "Accepted" || row.SlotBOptIn != "Accepted")
            return false;

        var ship = await _db.Ships.FindAsync(shipId);
        if (ship is null) return false;

        // Both accepted. Re-check pair existence now, not just at creation:
        // creation time couldn't check it if either slot was still
        // AwaitingUser, and that slot may have since resolved via onboarding.
        bool alreadyMatched = await _db.Matches.AnyAsync(m =>
            (m.InitiatorId == row.SlotAUserId && m.ReceiverId == row.SlotBUserId) ||
            (m.InitiatorId == row.SlotBUserId && m.ReceiverId == row.SlotAUserId));
        if (alreadyMatched)
        {
            ship.Status = "Expired";
            await _db.SaveChangesAsync();
            return false;
        }

        var match = new Match
        {
            InitiatorId = row.SlotAUserId!.Value,
            ReceiverId = row.SlotBUserId!.Value,
            Status = "Active",
            RevealLevel = 1,
            ShipId = ship.Id,
        };
        _db.Matches.Add(match);
        ship.Status = "Sparked";
        await _db.SaveChangesAsync();
        ship.ResultMatchId = match.Id;

        var shipperReward = await _loot.GrantGuaranteedAsync(ship.ShipperUserId, "ShipSparked");
        ship.ShipperRewardItemId = shipperReward?.Id;
        await _db.SaveChangesAsync();

        await _score.AwardAsync(ship.ShipperUserId, "ShipSparked");
        await GrantMilestoneTitleIfEarnedAsync(ship.ShipperUserId);

        // Mirrors MatchesController.RequestMatch's own first_match milestone
        // + push notification — a sparked thread is a normal Match from here
        // on, so both newly-matched users get the same "you have a match"
        // signals a regular match creates, not silence.
        await _milestones.AchieveAsync(row.SlotAUserId.Value, "first_match");
        await _milestones.AchieveAsync(row.SlotBUserId.Value, "first_match");

        await _push.NotifyUserAsync(
            row.SlotAUserId.Value,
            "Thread Sparked!",
            "A thread you accepted just became a match.",
            new Dictionary<string, object> { ["matchId"] = match.Id.ToString(), ["type"] = "match" });
        await _push.NotifyUserAsync(
            row.SlotBUserId.Value,
            "Thread Sparked!",
            "A thread you accepted just became a match.",
            new Dictionary<string, object> { ["matchId"] = match.Id.ToString(), ["type"] = "match" });

        return true;
    }

    private sealed class ShipOptInRow
    {
        public string SlotAOptIn { get; set; } = "";
        public string SlotBOptIn { get; set; } = "";
        public Guid? SlotAUserId { get; set; }
        public Guid? SlotBUserId { get; set; }
    }

    private async Task GrantMilestoneTitleIfEarnedAsync(Guid shipperId)
    {
        int sparkedCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.Status == "Sparked");
        string? itemId = sparkedCount switch
        {
            1 => "title_threadweaver",
            5 => "title_fateseer",
            10 => "title_bondkeeper",
            _ => null,
        };
        if (itemId is not null)
            await _loot.GrantSpecificAsync(shipperId, itemId, "ShipMilestone");
    }
}
