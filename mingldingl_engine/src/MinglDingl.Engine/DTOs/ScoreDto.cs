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
    DroppedItem? PendingShipReward = null);

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
