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
    string? EquippedTitleId = null,
    string? Oath = null,
    bool OathProven = false);

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
    string? WeaverDisplayName = null,
    Guid? FlameRiteProposedById = null,
    DateTime? FlameRiteProposedAt = null,
    DateTime? FlameRiteAcceptedAt = null,
    DateTime? FlameRiteCompletedAt = null,
    int FlameRiteDurationMinutes = 5,
    bool FlameRiteRequired = true,
    bool VideoEnabled = true);

public record PartialUserProfile(
    string? DisplayName,
    string? FirstPhoto,
    string? Bio,
    int? Age,
    string? SecondPhoto,
    string? ThirdPhoto,
    string? District,
    UserDeepFields? Deep,
    string? EquippedFrameId = null,
    string? EquippedTitleId = null,
    bool IsDeleted = false,
    string? Oath = null,
    bool OathProven = false);

public record UserDeepFields(
    bool? HasKids,
    string? SmokingHabit,
    string? DrinkingHabit,
    string? Religion,
    string? Lifestyle);
