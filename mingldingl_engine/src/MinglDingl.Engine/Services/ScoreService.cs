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
        "OathProven"      => 40,
        "GhostPenalty"    => -15,
        "ReportPenalty"   => -30,
        _ => 0
    };

    private static readonly (string Tier, int DefaultMinScore)[] TierDefaults =
    [
        ("Garnet", 0),
        ("Opal", 100),
        ("Amethyst", 300),
        ("Sapphire", 600),
        ("Ruby", 1000),
        ("Emerald", 2000)
    ];

    private static readonly string[] TierOrder = TierDefaults.Select(t => t.Tier).ToArray();

    private (string Tier, int MinScore)[] EffectiveTierTable() =>
        TierDefaults.Select(t => (
            t.Tier,
            t.Tier == "Sapphire" ? (int)_config.GetNumber("tier.sapphire.threshold", t.DefaultMinScore) : t.DefaultMinScore
        )).ToArray();

    public IReadOnlyList<(string Tier, int MinScore)> GetTierTable() => EffectiveTierTable();

    public string CalculateTier(int score)
    {
        var table = EffectiveTierTable();
        string tier = table[0].Tier;
        foreach (var (name, min) in table)
            if (score >= min) tier = name;
        return tier;
    }

    public async Task<int> RecomputeAllGemTiersAsync()
    {
        var table = EffectiveTierTable();

        var cases = string.Join(" ", table
            .Reverse()
            .Select(t => $"""WHEN "TotalScore" >= {t.MinScore} THEN '{t.Tier}'"""));
        var caseExpr = $"CASE {cases} ELSE '{table[0].Tier}' END";
#pragma warning disable EF1002
        return await _db.Database.ExecuteSqlRawAsync(
            $"""UPDATE "Users" SET "GemTier" = {caseExpr} WHERE "GemTier" <> {caseExpr}""");
#pragma warning restore EF1002
    }

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
            "Silver" => 12,
            "Gold"   => 20,
            _        => 5
        };

        int cap = user.MembershipLevel switch
        {
            "Silver" => 25,
            "Gold"   => 40,
            _        => 12
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
        if (gapDays == 2) return Math.Max(1, currentStreak / 2);
        return 1;
    }

    public static int DisplayStreak(int currentStreak, DateTime? lastLoginDate, DateTime today)
    {
        if (lastLoginDate is null) return currentStreak;
        var gapDays = (today.Date - lastLoginDate.Value.Date).Days;
        if (gapDays <= 1) return currentStreak;
        if (gapDays == 2) return Math.Max(1, currentStreak / 2);
        return currentStreak > 0 ? 1 : 0;
    }

    public async Task AwardAsync(Guid userId, string eventType)
    {
        int delta = GetDelta(eventType);
        if (delta == 0) return;

        int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
        if (newScore is null) return;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        await _db.SaveChangesAsync();
    }

    public async Task AwardWithDeltaAsync(Guid userId, string eventType, int delta)
    {
        if (delta == 0) return;

        int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: false);
        if (newScore is null) return;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        await _db.SaveChangesAsync();
    }

    public async Task AwardManyAsync(IEnumerable<(Guid UserId, string EventType)> awards)
    {
        var list = awards as IReadOnlyCollection<(Guid UserId, string EventType)> ?? awards.ToList();
        if (list.Count == 0) return;

        foreach (var (userId, eventType) in list)
        {
            int delta = GetDelta(eventType);
            if (delta == 0) continue;

            int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
            if (newScore is null) continue;

            _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
        }

        await _db.SaveChangesAsync();
    }

    public async Task<decimal?> ApplyReputationPenaltyAsync(Guid userId, string eventType)
    {
        var repResult = await _db.Database.SqlQuery<decimal>(
            $"""
            UPDATE "Users" SET "ReputationScore" = GREATEST(0, "ReputationScore" - 0.1)
            WHERE "Id" = {userId}
            RETURNING "ReputationScore"
            """).ToListAsync();
        if (repResult.Count == 0) return null;

        decimal newReputation = repResult[0];
        var tracked = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (tracked is not null) tracked.ReputationScore = newReputation;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = 0 });
        await _db.SaveChangesAsync();

        return newReputation;
    }

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

    private void SyncTrackedUser(Guid userId, int newScore, string newTier, decimal? newReputation)
    {
        var tracked = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (tracked is null) return;
        tracked.TotalScore = newScore;
        tracked.GemTier = newTier;
        if (newReputation.HasValue) tracked.ReputationScore = newReputation.Value;
    }
}
