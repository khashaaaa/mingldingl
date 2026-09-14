using Microsoft.EntityFrameworkCore;
using Npgsql;

public class ScoreService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    public ScoreService(AppDbContext db, ConfigService config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// The design table's score values. Live values come from <c>score.event.&lt;EventType&gt;</c>
    /// config and fall back to these; an unknown event type is worth nothing.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, int> DefaultDeltas = new Dictionary<string, int>
    {
        ["ProfileComplete"] = 100,
        ["DailyLogin"]      = 5,
        ["FirstMessage"]    = 10,
        ["IcebreakerDone"]  = 20,
        ["QuizDone"]        = 15,
        ["MatchReply"]      = 10,
        ["DateConfirmed"]   = 50,
        ["VideoCallDone"]   = 30,
        ["ShipSparked"]     = 40,
        ["OathProven"]      = 40,
        ["GhostPenalty"]    = -15,
        // Reserved: the design table specifies -30 for a negative report, but no reporting
        // endpoint exists yet, so nothing awards this. Tracked under Outstanding Follow-ups.
        ["ReportPenalty"]   = -30,
    };

    public int Delta(string eventType) =>
        DefaultDeltas.TryGetValue(eventType, out var fallback)
            ? (int)_config.GetNumber($"score.event.{eventType}", fallback)
            : 0;

    /// <summary>Extra score on every seventh consecutive daily login.</summary>
    public int WeeklyStreakBonus => (int)_config.GetNumber("score.streak.weekly_bonus", 50);

    /// <summary>Score for opening the bounty chest once all of the day's quests are done.</summary>
    public int QuestChestXp => (int)_config.GetNumber("score.quest_chest", 30);

    /// <summary>How much ReputationScore a ghost or repeated no-show costs.</summary>
    private decimal ReputationDock => (decimal)_config.GetNumber("reputation.penalty_dock", 0.1);

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

    /// <summary>The design ladder, for callers (the seeder) that must reason about it without a config.</summary>
    public static IReadOnlyList<(string Tier, int DefaultMinScore)> DefaultTierTable => TierDefaults;

    /// <summary>The slots a membership level starts each day with; shared with the tier catalogue so the perk shown matches the budget enforced.</summary>
    public static int BaseBudgetFor(ConfigService config, string membershipLevel)
    {
        string level = membershipLevel switch { "Silver" => "silver", "Gold" => "gold", _ => "free" };
        int fallback = membershipLevel switch { "Silver" => 12, "Gold" => 20, _ => 5 };
        return Math.Max(0, (int)config.GetNumber($"budget.base.{level}", fallback));
    }

    public static string TierThresholdKey(string tier) => $"tier.{tier.ToLowerInvariant()}.threshold";

    private (string Tier, int MinScore)[] EffectiveTierTable() =>
        TierDefaults.Select((t, i) => (
            t.Tier,
            i == 0 ? t.DefaultMinScore : (int)_config.GetNumber(TierThresholdKey(t.Tier), t.DefaultMinScore)
        )).ToArray();

    public IReadOnlyList<(string Tier, int MinScore)> GetTierTable() => EffectiveTierTable();

    /// <summary>
    /// Null when <paramref name="value"/> keeps the ladder strictly increasing; otherwise the
    /// reason, so the admin sees why a threshold was refused rather than a silent mis-tiering.
    /// </summary>
    public string? ValidateTierThreshold(string key, int value)
    {
        var table = EffectiveTierTable();
        int idx = Array.FindIndex(table, t => TierThresholdKey(t.Tier) == key);
        if (idx <= 0) return idx == 0 ? $"{key} is the floor tier and cannot be changed" : null;

        int lower = table[idx - 1].MinScore;
        int? upper = idx < table.Length - 1 ? table[idx + 1].MinScore : null;
        if (value <= lower || (upper is int u && value >= u))
        {
            string upperText = upper?.ToString() ?? "∞";
            return $"{key} must be between {lower} and {upperText} (exclusive) so tiers stay in order";
        }
        return null;
    }

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
        var caseExpr = TierCaseSql("\"TotalScore\"");
#pragma warning disable EF1002
        return await _db.Database.ExecuteSqlRawAsync(
            $"""UPDATE "Users" SET "GemTier" = {caseExpr} WHERE "GemTier" <> {caseExpr}""");
#pragma warning restore EF1002
    }

    /// <summary>The tier ladder as SQL over <paramref name="scoreExpr"/>; thresholds are config integers and tier names constants, never user input.</summary>
    private string TierCaseSql(string scoreExpr)
    {
        var table = EffectiveTierTable();
        var cases = string.Join(" ", table
            .Reverse()
            .Select(t => $"WHEN {scoreExpr} >= {t.MinScore} THEN '{t.Tier}'"));
        return $"CASE {cases} ELSE '{table[0].Tier}' END";
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

    private int BudgetNumber(string kind, string membershipLevel, int fallback)
    {
        string level = membershipLevel switch { "Silver" => "silver", "Gold" => "gold", _ => "free" };
        return (int)_config.GetNumber($"budget.{kind}.{level}", fallback);
    }

    public int DailyMatchBudget(User user)
    {
        int baseBudget = BaseBudgetFor(_config, user.MembershipLevel);

        int cap = BudgetNumber("cap", user.MembershipLevel, user.MembershipLevel switch
        {
            "Silver" => 25,
            "Gold"   => 40,
            _        => 12
        });
        int divisor = Math.Max(1, (int)_config.GetNumber("budget.score_divisor", 50));
        int bonus = user.TotalScore / divisor;
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

    /// <summary>
    /// A ghost penalty is more than its score delta: it also docks reputation and leaves the
    /// ScoreEvent row the Oath logic reads. An admin setting the score part to 0 must not
    /// silently switch those off, so it is the one event that proceeds with a zero delta.
    /// </summary>
    private static bool ProceedsWithZeroDelta(string eventType) => eventType == "GhostPenalty";

    public virtual async Task AwardAsync(Guid userId, string eventType, Guid? matchId = null)
    {
        int delta = Delta(eventType);
        if (delta == 0 && !ProceedsWithZeroDelta(eventType)) return;

        // The score UPDATE and its ScoreEvent commit together: autocommitting the score first left a
        // paid award with no event row whenever the insert failed.
        await _db.InTransactionAsync(async () =>
        {
            int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
            if (newScore is null) return;

            _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta, MatchId = matchId });
            await _db.SaveChangesAsync();
        });
    }

    /// <summary>
    /// Pays <c>MatchReply</c> unless this conversation has already paid today's cap. The count and
    /// the insert run under one advisory lock per (user, match): checked separately, concurrent
    /// replies all read the same count and all paid past the cap.
    /// </summary>
    public async Task<bool> TryAwardMatchReplyAsync(Guid userId, Guid matchId)
    {
        int cap = MatchReplyDailyCapPerMatch;
        if (cap == 0) return false;

        return await _db.InTransactionAsync(async () =>
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({MatchReplyLockKey(userId, matchId)})");
            if (await CountMatchReplyAwardsTodayAsync(userId, matchId) >= cap) return false;
            await AwardAsync(userId, "MatchReply", matchId);
            return true;
        });
    }

    private static long MatchReplyLockKey(Guid userId, Guid matchId)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            [.. "MatchReply"u8.ToArray(), .. userId.ToByteArray(), .. matchId.ToByteArray()]);
        return BitConverter.ToInt64(hash, 0);
    }

    /// <summary>
    /// Spends one of today's summons slots if <paramref name="me"/> still has one. The check and the
    /// increment are one conditional UPDATE, so concurrent summons to different targets cannot both
    /// pass a stale read and exceed the budget. Returns the new count, or null when none was left.
    /// </summary>
    public async Task<int?> TryConsumeDailyMatchAsync(User me)
    {
        int budget = DailyMatchBudget(me);
        var used = await _db.Database.SqlQuery<int>(
            $"""
            UPDATE "Users" SET "DailyMatchesUsed" = "DailyMatchesUsed" + 1
            WHERE "Id" = {me.Id} AND "DailyMatchesUsed" < {budget}
            RETURNING "DailyMatchesUsed"
            """).ToListAsync();
        if (used.Count == 0) return null;

        var tracked = _db.Tracked<User>(u => u.Id == me.Id);
        if (tracked is not null) _db.SyncFromDatabase(tracked, u => u.DailyMatchesUsed, used[0]);
        return used[0];
    }

    /// <summary>
    /// How many replies in this conversation have already paid today. <c>MatchReply</c> had no cap
    /// at all: two accounts alternating one-character messages climbed the whole ladder unopposed.
    /// </summary>
    public Task<int> CountMatchReplyAwardsTodayAsync(Guid userId, Guid matchId)
    {
        var since = DateTime.UtcNow.Date;
        return _db.ScoreEvents.CountAsync(e =>
            e.UserId == userId && e.MatchId == matchId && e.EventType == "MatchReply" && e.CreatedAt >= since);
    }

    /// <summary>Replies worth score per conversation per UTC day; beyond it the thread still works, it just stops paying.</summary>
    public int MatchReplyDailyCapPerMatch =>
        Math.Max(0, (int)_config.GetNumber("score.match_reply.daily_cap_per_match", 10));

    /// <summary>
    /// Awards an event whose ScoreEvent row is guarded by one of the partial unique indexes
    /// (once per UTC day, or once ever). The row is claimed <em>before</em> the score moves:
    /// <see cref="AwardWithDeltaAsync"/> pays first, so the loser of a race keeps the points
    /// even though its event row is rejected. Returns false when the claim was already taken.
    /// </summary>
    public virtual async Task<bool> TryAwardClaimedAsync(Guid userId, string eventType, int delta)
    {
        if (delta == 0) return false;

        var claim = new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta };
        _db.ScoreEvents.Add(claim);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ScoreEventClaimGuard.IsViolation(ex))
        {
            _db.Entry(claim).State = EntityState.Detached;
            return false;
        }

        await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: false);
        return true;
    }

    public async Task AwardWithDeltaAsync(Guid userId, string eventType, int delta)
    {
        if (delta == 0) return;

        await _db.InTransactionAsync(async () =>
        {
            int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: false);
            if (newScore is null) return;

            _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
            await _db.SaveChangesAsync();
        });
    }

    public async Task AwardManyAsync(IEnumerable<(Guid UserId, string EventType)> awards)
    {
        var list = awards as IReadOnlyCollection<(Guid UserId, string EventType)> ?? awards.ToList();
        if (list.Count == 0) return;

        await _db.InTransactionAsync(async () =>
        {
            foreach (var (userId, eventType) in list)
            {
                int delta = Delta(eventType);
                if (delta == 0 && !ProceedsWithZeroDelta(eventType)) continue;

                int? newScore = await ApplyScoreDeltaAsync(userId, delta, isGhostPenalty: eventType == "GhostPenalty");
                if (newScore is null) continue;

                _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = delta });
            }

            await _db.SaveChangesAsync();
        });
    }

    public async Task<decimal?> ApplyReputationPenaltyAsync(Guid userId, string eventType)
    {
        decimal dock = ReputationDock;
        return await _db.InTransactionAsync(async () =>
        {
            var repResult = await _db.Database.SqlQuery<decimal>(
                $"""
                UPDATE "Users" SET "ReputationScore" = GREATEST(0, "ReputationScore" - {dock})
                WHERE "Id" = {userId}
                RETURNING "ReputationScore"
                """).ToListAsync();
            if (repResult.Count == 0) return (decimal?)null;

            decimal newReputation = repResult[0];
            var tracked = _db.Tracked<User>(u => u.Id == userId);
            if (tracked is not null) _db.SyncFromDatabase(tracked, u => u.ReputationScore, newReputation);

            _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = 0 });
            await _db.SaveChangesAsync();

            return newReputation;
        });
    }

    private sealed record ScoreRow(int TotalScore, string GemTier, decimal ReputationScore);

    private async Task<int?> ApplyScoreDeltaAsync(Guid userId, int delta, bool isGhostPenalty)
    {
        // Score, tier and (for a ghost) reputation move in one statement, the tier computed from the
        // new score in SQL: a second UPDATE for the tier let a concurrent award land in between and
        // leave the tier of whichever request wrote last, not of the score that stuck.
        const string newScore = "GREATEST(0, \"TotalScore\" + @delta)";
        var parameters = new List<object> { new NpgsqlParameter("delta", delta), new NpgsqlParameter("userId", userId) };
        string reputation = "";
        if (isGhostPenalty)
        {
            reputation = ", \"ReputationScore\" = GREATEST(0, \"ReputationScore\" - @dock)";
            parameters.Add(new NpgsqlParameter("dock", ReputationDock));
        }

#pragma warning disable EF1002
        var rows = await _db.Database.SqlQueryRaw<ScoreRow>(
            $"""
            UPDATE "Users" SET "TotalScore" = {newScore}, "GemTier" = {TierCaseSql(newScore)}{reputation}
            WHERE "Id" = @userId
            RETURNING "TotalScore", "GemTier", "ReputationScore"
            """,
            parameters.ToArray()).ToListAsync();
#pragma warning restore EF1002
        if (rows.Count == 0) return null;

        var row = rows[0];
        var tracked = _db.Tracked<User>(u => u.Id == userId);
        if (tracked is not null)
        {
            _db.SyncFromDatabase(tracked, u => u.TotalScore, row.TotalScore);
            _db.SyncFromDatabase(tracked, u => u.GemTier, row.GemTier);
            if (isGhostPenalty) _db.SyncFromDatabase(tracked, u => u.ReputationScore, row.ReputationScore);
        }
        return row.TotalScore;
    }
}
