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

// Message *content* deliberately isn't surfaced here — MessageCount (already
// on Match) is enough to see whether a conversation is active for support
// purposes, without an admin panel doubling as a private-message reader.
public record AdminUserMatchDto(
    Guid MatchId, Guid OtherUserId, string OtherUserDisplayName, string Status, int MessageCount, DateTime CreatedAt);

public record AdminUserShipDto(Guid ShipId, string Role, string Status, DateTime CreatedAt);

public record AdminUserTownSquareRsvpDto(Guid SessionId, DateTime ScheduledStartAt, string SessionStatus, DateTime RsvpAt);

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
    IReadOnlyList<AdminBlockRelationDto> UsersWhoBlockedThem,
    IReadOnlyList<AdminUserMatchDto> RecentMatches,
    IReadOnlyList<AdminUserShipDto> Ships,
    IReadOnlyList<AdminUserTownSquareRsvpDto> TownSquareRsvps);

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
