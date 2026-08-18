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
        int delta = GetDelta(eventType);
        if (delta == 0) return;

        int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
        if (newScore is null) return; // user not found

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        await _db.SaveChangesAsync();
    }

    // Award with a caller-computed delta (streak multipliers, chest XP). Bypasses GetDelta.
    public async Task AwardWithDeltaAsync(Guid userId, string eventType, int delta)
    {
        if (delta == 0) return;

        int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: false);
        if (newScore is null) return; // user not found

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        await _db.SaveChangesAsync();
    }

    // Awards multiple (userId, eventType) pairs — each user's delta is applied
    // atomically (see ApplyScoreDeltaAsync), then every ScoreEvent row is
    // persisted together in one final round trip.
    public async Task AwardManyAsync(IEnumerable<(Guid UserId, string EventType)> awards)
    {
        var list = awards as IReadOnlyCollection<(Guid UserId, string EventType)> ?? awards.ToList();
        if (list.Count == 0) return;

        foreach (var (userId, eventType) in list)
        {
            int delta = GetDelta(eventType);
            if (delta == 0) continue;

            int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
            if (newScore is null) continue; // user not found

            _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        }

        await _db.SaveChangesAsync();
    }

    // Reputation-only penalty — GhostPenalty's isGhostPenalty branch docks
    // both TotalScore and ReputationScore together, and AwardAsync/GetDelta
    // early-return on a zero TotalScore delta before ever reaching the DB, so
    // neither path can express "touch ReputationScore only." Same atomic
    // UPDATE ... RETURNING shape as that branch, to close the identical
    // lost-update race under concurrent penalties to the same user.
    public async Task<decimal?> ApplyReputationPenaltyAsync(Guid userId, string eventType)
    {
        var repResult = await _db.Database.SqlQuery<decimal>(
            $"""
            UPDATE "Users" SET "ReputationScore" = GREATEST(0, "ReputationScore" - 0.1)
            WHERE "Id" = {userId}
            RETURNING "ReputationScore"
            """).ToListAsync();
        if (repResult.Count == 0) return null; // user not found

        decimal newReputation = repResult[0];
        var tracked = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (tracked is not null) tracked.ReputationScore = newReputation;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = 0 });
        await _db.SaveChangesAsync();

        return newReputation;
    }

    // Atomic increment — loading TotalScore, adjusting it in memory, and saving
    // separately is a lost-update race under concurrent awards to the same user
    // (the same class of bug MessagesController.SendMessage's MessageCount fix
    // closed: two awards racing on one user can silently drop one delta).
    // UPDATE ... RETURNING does the adjustment and reads the resulting score
    // back in the same round trip, with no window between the update and a
    // separate read of "the new value". GemTier is then derived from that
    // authoritative score and written in a second statement — a small window
    // remains where two overlapping awards could each write a GemTier computed
    // from a since-superseded score, but that self-corrects at the very next
    // score event, unlike a lost TotalScore delta, which is gone for good.
    // Returns null (no-op) if the user doesn't exist.
    private async Task<int?> ApplyScoreDeltaAsync(Guid userId, int delta, bool isGhostPenalty)
    {
        var scoreResult = await _db.Database.SqlQuery<int>(
            $"""
            UPDATE "Users" SET "TotalScore" = GREATEST(0, "TotalScore" + {delta})
            WHERE "Id" = {userId}
            RETURNING "TotalScore"
            """).ToListAsync();
        if (scoreResult.Count == 0) return null;

        int newScore = scoreResult[0];
        string newTier = CalculateTier(newScore);
        decimal? newReputation = null;

        if (isGhostPenalty)
        {
            var repResult = await _db.Database.SqlQuery<decimal>(
                $"""
                UPDATE "Users" SET "GemTier" = {newTier}, "ReputationScore" = GREATEST(0, "ReputationScore" - 0.1)
                WHERE "Id" = {userId}
                RETURNING "ReputationScore"
                """).ToListAsync();
            newReputation = repResult.Count > 0 ? repResult[0] : null;
        }
        else
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Users" SET "GemTier" = {newTier} WHERE "Id" = {userId}""");
        }

        SyncTrackedUser(userId, newScore, newTier, newReputation);
        return newScore;
    }

    // The raw SQL above bypasses EF's change tracker on purpose, for
    // correctness under concurrency (see this method's caller). But a caller
    // that already holds this same user as a tracked entity from earlier in
    // the same request — e.g. UsersController.Upsert building its response
    // from the very User it just awarded score to — needs that in-memory
    // copy kept in sync, or it would serialize the stale pre-award score
    // back to the client despite the DB row being correct.
    private void SyncTrackedUser(Guid userId, int newScore, string newTier, decimal? newReputation)
    {
        var tracked = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (tracked is null) return;
        tracked.TotalScore = newScore;
        tracked.GemTier = newTier;
        if (newReputation.HasValue) tracked.ReputationScore = newReputation.Value;
    }
}
