public record CandidateResponse(
    Guid Id,
    string DisplayName,
    int Age,
    string City,
    string GemTier,
    decimal ReputationScore,
    List<string> PhotoUrls,
    string Bio,
    string? EquippedFrameId = null,
    string? EquippedTitleId = null);

// Awarded reflects the real total (0 unless today's rotated daily quest is
// "Send a Summons" and this is the first one) — sending a summons has no
// guaranteed base score of its own, so the client must not assume a fixed
// amount here.
public record CreateMatchResponse(Guid MatchId, int Awarded = 0);

public record GhostCheckResponse(string Status);

public record MatchResponse(
    Guid MatchId,
    Guid OtherUserId,
    string Status,
    int RevealLevel,
    int MessageCount,
    bool IcebreakerComplete,
    bool VideoCallUnlocked,
    PartialUserProfile OtherUser,
    string? WeaverDisplayName = null);

public record PartialUserProfile(
    string? DisplayName,    // revealed at level 1
    string? FirstPhoto,     // revealed at level 1
    string? Bio,            // revealed at level 1
    int? Age,               // revealed at level 2
    string? SecondPhoto,    // revealed at level 2
    string? ThirdPhoto,     // revealed at level 3
    string? District,       // revealed at level 3
    UserDeepFields? Deep,   // revealed at level 4 (membership-gated)
    string? EquippedFrameId = null,
    string? EquippedTitleId = null,
    // True once DailyMaintenanceBackgroundService has anonymized this person
    // (7+ days past a deletion request) — every other field above is blank
    // in that case, not just unrevealed. The client renders a localized
    // "Deleted User" placeholder instead of an empty name, not raw text
    // from here, same reasoning as membership's FeatureKeys.
    bool IsDeleted = false);

public record UserDeepFields(
    bool? HasKids,
    string? SmokingHabit,
    string? DrinkingHabit,
    string? Religion,
    string? Lifestyle);
