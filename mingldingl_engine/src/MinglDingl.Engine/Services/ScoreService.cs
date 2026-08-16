using Microsoft.EntityFrameworkCore;

public class ScoreService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    public ScoreService(AppDbContext db, ConfigService config)
    {
        _db = db;
        _config = config;
    }

    public static int GetDelta(string eventType) => eventType switch
    {
        "ProfileComplete" => 100,
        "DailyLogin"      => 5,
        "FirstMessage"    => 10,
        "IcebreakerDone"  => 20,
        "QuizDone"        => 15,
        "MatchReply"      => 10,
        "DateConfirmed"   => 50,
        "VideoCallDone"   => 30,
        "ShipSparked"     => 40,
        "GhostPenalty"    => -15,
        "ReportPenalty"   => -30,
        _ => 0
    };

    // Default cutoffs, used as-is for every tier except Sapphire, whose
    // live value comes from ConfigService (key "tier.sapphire.threshold")
    // instead — see EffectiveTierTable. The rest move the same way in a
    // later sub-project.
    private static readonly (string Tier, int DefaultMinScore)[] TierDefaults =
    [
        ("Garnet", 0),
        ("Opal", 100),
        ("Amethyst", 300),
        ("Sapphire", 600),
        ("Ruby", 1000),
        ("Emerald", 2000)
    ];

    // Tier *order* never changes even if a threshold does, so this stays a
    // static array and TierIndex stays a static method — DailyMatchBudget's
    // flat per-tier bonus depends only on ordinal position, not on the
    // score cutoffs, so it's unaffected by this migration.
    private static readonly string[] TierOrder = TierDefaults.Select(t => t.Tier).ToArray();

    private (string Tier, int MinScore)[] EffectiveTierTable() =>
        TierDefaults.Select(t => (
            t.Tier,
            t.Tier == "Sapphire" ? (int)_config.GetNumber("tier.sapphire.threshold", t.DefaultMinScore) : t.DefaultMinScore
        )).ToArray();

    // Exposes the live table to GET /scores/tiers so the client fetches
    // this instead of hand-maintaining its own copy of the cutoffs (see
    // mingldingl_app/lib/tiers.ts) — the two drifted out of sync once
    // already, causing a tier-up toast to fire early and then revert.
    public IReadOnlyList<(string Tier, int MinScore)> GetTierTable() => EffectiveTierTable();

    public string CalculateTier(int score)
    {
        var table = EffectiveTierTable();
        string tier = table[0].Tier;
        foreach (var (name, min) in table)
            if (score >= min) tier = name;
        return tier;
    }

    // Position in TierOrder (Garnet=0 .. Emerald=5). Doubles as the flat
    // per-tier match-budget bonus applied in DailyMatchBudget below.
    public static int TierIndex(string gemTier)
    {
        int i = Array.IndexOf(TierOrder, gemTier);
        return i >= 0 ? i : 0;
    }

    public (string? NextTier, int? NextTierThreshold, double ProgressPct) TierProgress(int score)
    {
        var table = EffectiveTierTable();
        int idx = TierIndex(CalculateTier(score));
        if (idx == table.Length - 1) return (null, null, 100.0);
        var (_, curMin) = table[idx];
        var (nextTier, nextMin) = table[idx + 1];
        double pct = Math.Round((score - curMin) * 100.0 / (nextMin - curMin), 1);
        return (nextTier, nextMin, pct);
    }

    public static bool IsProfileComplete(User user) =>
        !string.IsNullOrEmpty(user.DisplayName) &&
        user.Age > 0 &&
        !string.IsNullOrEmpty(user.Gender) &&
        !string.IsNullOrEmpty(user.City) &&
        !string.IsNullOrEmpty(user.Bio) &&
        user.PhotoUrls.Count >= 3;

    public static int DailyMatchBudget(User user)
    {
        int baseBudget = user.MembershipLevel switch
        {
            "Silver"   => 10,
            "Gold"     => 15,
            "Platinum" => 20,
            _          => 5
        };
        // Per-tier cap: Silver members cap at 12, Gold at 15 (base), Platinum/Free at 20
        int cap = user.MembershipLevel switch
        {
            "Silver"   => 12,
            "Gold"     => 15,
            "Platinum" => 20,
            _          => 20
        };
        int bonus = user.TotalScore / 50;
        int tierBonus = TierIndex(user.GemTier);
        return Math.Min(baseBudget + bonus + tierBonus, cap + tierBonus);
    }

    public static int ComputeStreak(int currentStreak, DateTime? lastLoginDate, DateTime today)
    {
        if (lastLoginDate is null) return 1;
        var gapDays = (today.Date - lastLoginDate.Value.Date).Days;
        if (gapDays == 0) return Math.Max(1, currentStreak);
        if (gapDays == 1) return currentStreak + 1;
        if (gapDays == 2) return Math.Max(1, currentStreak / 2); // missed exactly one day: soft decay, not reset
        return 1; // missed 2+ days: hard reset
    }

    public async Task AwardAsync(Guid userId, string eventType)
    {
        ApplyAward(await _db.Users.FindAsync(userId), eventType);
        await _db.SaveChangesAsync();
    }

    // Award with a caller-computed delta (streak multipliers, chest XP). Bypasses GetDelta.
    public async Task AwardWithDeltaAsync(Guid userId, string eventType, int delta)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null || delta == 0) return;
        _db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = eventType, Delta = delta });
        user.TotalScore = Math.Max(0, user.TotalScore + delta);
        user.GemTier = CalculateTier(user.TotalScore);
        await _db.SaveChangesAsync();
    }

    // Awards multiple (userId, eventType) pairs in a single round trip: one query
    // to load all affected users, one SaveChangesAsync to persist every delta.
    public async Task AwardManyAsync(IEnumerable<(Guid UserId, string EventType)> awards)
    {
        var list = awards as IReadOnlyCollection<(Guid UserId, string EventType)> ?? awards.ToList();
        if (list.Count == 0) return;

        var userIds = list.Select(a => a.UserId).Distinct().ToList();
        var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);

        foreach (var (userId, eventType) in list)
            ApplyAward(users.GetValueOrDefault(userId), eventType);

        await _db.SaveChangesAsync();
    }

    private void ApplyAward(User? user, string eventType)
    {
        if (user is null) return;

        int delta = GetDelta(eventType);
        if (delta == 0) return;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = eventType, Delta = delta });
        user.TotalScore = Math.Max(0, user.TotalScore + delta);
        user.GemTier = CalculateTier(user.TotalScore);

        if (eventType == "GhostPenalty")
        {
            user.ReputationScore = Math.Max(0, user.ReputationScore - 0.1m);
        }
    }
}
