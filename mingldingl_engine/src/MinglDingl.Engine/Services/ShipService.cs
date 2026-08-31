using Microsoft.EntityFrameworkCore;

public class ShipService
{
    private readonly AppDbContext _db;
    private readonly LootService _loot;
    private readonly ScoreService _score;
    private readonly ConfigService _config;
    private readonly MilestoneService _milestones;
    private readonly PushNotificationService _push;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ILogger<ShipService> _logger;

    public ShipService(AppDbContext db, LootService loot, ScoreService score, ConfigService config, MilestoneService milestones, PushNotificationService push, SupabaseBroadcastService broadcast, ILogger<ShipService> logger)
    {
        _db = db;
        _loot = loot;
        _score = score;
        _config = config;
        _milestones = milestones;
        _push = push;
        _broadcast = broadcast;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error, string? SlotACode, string? SlotBCode)> CreateAsync(Guid shipperId, string slotAPhone, string slotBPhone)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(slotAPhone, @"^\d{8}$") ||
            !System.Text.RegularExpressions.Regex.IsMatch(slotBPhone, @"^\d{8}$"))
            return (false, "Phone numbers must be 8 digits", null, null);

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
            chars[i] = InviteCode.Alphabet[Random.Shared.Next(InviteCode.Alphabet.Length)];
        return new string(chars);
    }

    private async Task<bool> CodeExistsAsync(string code) =>
        await _db.Users.AnyAsync(u => u.ReferralCode == code) ||
        await _db.Ships.AnyAsync(s => s.SlotAInviteCode == code || s.SlotBInviteCode == code);

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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ship invite-code resolution swallowed a failure for new user {UserId} (code {Code})", newUserId, code);

            _db.ChangeTracker.Clear();
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
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Ships" SET "Status" = 'Declined' WHERE "Id" = {shipId}""");
            return false;
        }

        if (row.SlotAOptIn != "Accepted" || row.SlotBOptIn != "Accepted")
            return false;

        var ship = await _db.Ships.FindAsync(shipId);
        if (ship is null) return false;

        bool alreadyMatched = await MatchPairing.PairAlreadyMatchedAsync(_db, row.SlotAUserId!.Value, row.SlotBUserId!.Value);
        bool blocked = await MatchPairing.IsPairBlockedAsync(_db, row.SlotAUserId!.Value, row.SlotBUserId!.Value);
        if (alreadyMatched || blocked)
        {
            ship.Status = "Expired";
            await _db.SaveChangesAsync();
            return false;
        }

        var match = MatchPairing.NewMatch(row.SlotAUserId!.Value, row.SlotBUserId!.Value, ship.Id);
        _db.Matches.Add(match);
        ship.Status = "Sparked";
        await _db.SaveChangesAsync();

        ship.ResultMatchId = match.Id;
        await _db.SaveChangesAsync();

        var shipperReward = await _loot.GrantGuaranteedAsync(ship.ShipperUserId, "ShipSparked");
        if (shipperReward is not null)
        {
            ship.ShipperRewardItemId = shipperReward.Id;
            await _db.SaveChangesAsync();
        }

        await _score.AwardAsync(ship.ShipperUserId, "ShipSparked");
        await GrantMilestoneTitleIfEarnedAsync(ship.ShipperUserId);

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
        await _broadcast.BroadcastAsync("app-nudges", "match_created",
            new { matchId = match.Id, userIds = new[] { match.InitiatorId, match.ReceiverId }, source = "ship" });

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
