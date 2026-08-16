public record AdminUserListItemDto(
    Guid Id,
    string DisplayName,
    int Age,
    string City,
    string GemTier,
    string MembershipLevel,
    int TotalScore,
    bool IsPaused,
    bool IsDeleted,
    bool IsBanned,
    DateTime CreatedAt);

public record AdminBlockRelationDto(Guid UserId, string DisplayName, DateTime CreatedAt);

public record AdminUserDetailDto(
    Guid Id,
    string? PhoneNumber,
    string DisplayName,
    int Age,
    string Gender,
    string City,
    string Bio,
    IReadOnlyList<string> PhotoUrls,
    bool? HasKids,
    string? SmokingHabit,
    string? DrinkingHabit,
    string? Religion,
    string? Lifestyle,
    int TotalScore,
    string GemTier,
    decimal ReputationScore,
    string MembershipLevel,
    DateTime? MembershipExpiresAt,
    int CurrentStreak,
    int LongestStreak,
    bool IsPaused,
    bool IsDeleted,
    bool IsBanned,
    DateTime? BannedAt,
    string? BanReason,
    DateTime? DeletionRequestedAt,
    DateTime CreatedAt,
    IReadOnlyList<ScoreEventDto> RecentScoreEvents,
    IReadOnlyList<AdminBlockRelationDto> UsersBlockedByThem,
    IReadOnlyList<AdminBlockRelationDto> UsersWhoBlockedThem);

// DaysRemaining is 7 (the grace period DailyMaintenanceBackgroundService
// enforces) minus days elapsed since DeletionRequestedAt, floored at 0.
public record AdminDeletionRequestDto(
    Guid Id,
    string DisplayName,
    string City,
    DateTime DeletionRequestedAt,
    int DaysRemaining);

public record AdminBanUserRequest(string? Reason);

public record AdminAdjustScoreRequest(int Delta, string Reason);
