public record ScoreResponse(
    int TotalScore,
    string GemTier,
    decimal ReputationScore,
    int DailyMatchBudget,
    int DailyMatchesUsed,
    int DailyMatchesRemaining);

public record DailyLoginResponse(
    int Awarded,
    string? Message = null,
    int CurrentStreak = 0,
    int LongestStreak = 0,
    bool StreakBonusAwarded = false);

/// <param name="ThreadsSparked">
/// Fated threads this user wove that reached <c>Sparked</c> — the count the thread honours
/// (Thread-Weaver / Fate-Seer / Bond-Keeper at 1 / 5 / 10) are granted on, so the honours hall
/// can show how close a dark slot is instead of only what it asks for.
/// </param>
public record ScoreDetailResponse(
    int TotalScore,
    string GemTier,
    decimal ReputationScore,
    int CurrentStreak,
    int LongestStreak,
    int TierIndex,
    int TierBonus,
    string? NextTier,
    int? NextTierThreshold,
    double ProgressPct,
    int DailyMatchBudget,
    DroppedItem? PendingReferralReward = null,
    DroppedItem? PendingShipReward = null,
    int ThreadsSparked = 0);

public record AckNotificationDto(string Kind);

public record AckNotificationResponse(bool Acknowledged);

public record ScoreEventDto(string EventType, int Delta, DateTime CreatedAt);

public record ScoreHistoryResponse(IReadOnlyList<ScoreEventDto> Items, DateTime? NextCursor, Guid? NextCursorId);

// Deliberately carries no display name: the leaderboard is anonymous, in keeping with
// progressive profile reveal. Score is the basis of the ranking and is what makes one row
// distinguishable from the next, so it is the one figure worth showing.
public record LeaderboardEntryDto(int Rank, string GemTier, int Score, bool IsCurrentUser);

public record LeaderboardResponse(string City, IReadOnlyList<LeaderboardEntryDto> Entries, int MyRank);

public record TierThresholdDto(string Tier, int MinScore);

public record TierThresholdsResponse(IReadOnlyList<TierThresholdDto> Tiers);

public record RevealThresholdDto(int Level, int Messages);

/// <summary>The admin-tunable reveal ladder, so the app never pins its own copy of the message counts.</summary>
/// <param name="ActivitySuggestionMessages">
/// Mutual messages needed before <c>GET /activities/{matchId}</c> will hand back suggestions
/// (<c>activity.suggestions.messages</c>). Served alongside the reveal ladder because it is the
/// same kind of admin-tunable gate: without it the app could only discover the threshold by being
/// refused, so it offered the door unconditionally and had no countdown to show.
/// </param>
public record RevealThresholdsResponse(
    IReadOnlyList<RevealThresholdDto> Levels,
    int ActivitySuggestionMessages = 15);
