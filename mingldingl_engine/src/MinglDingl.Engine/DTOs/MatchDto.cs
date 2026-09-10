public record CandidateResponse(
    Guid Id,
    string DisplayName,
    int Age,
    string City,
    string GemTier,
    decimal ReputationScore,
    List<string> PhotoUrls,
    string Bio,
    string? EquippedTitleId = null,
    string? Oath = null,
    bool OathProven = false,
    /// <summary>
    /// How many photos this person has at all, independent of how many are revealed. Without it the
    /// app cannot tell an unearned slot from one that will never be filled, and a two-photo profile
    /// shows a padlock on the third that no amount of conversation opens.
    /// </summary>
    int PhotoCount = 0);

public record CreateMatchResponse(Guid MatchId, int Awarded = 0);

public record GhostCheckResponse(string Status);

/// <param name="MessageCount">
/// How far the conversation has come for gating purposes — <see cref="RevealService.MutualMessageCount"/>,
/// not the raw total. The app draws its reveal countdown from this, so sending the raw total made the
/// strip promise a rung a one-sided conversation can never reach.
/// </param>
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
    string? EquippedTitleId = null,
    bool IsDeleted = false,
    string? Oath = null,
    bool OathProven = false,
    /// <summary>
    /// How many photos this person has at all, independent of how many are revealed. Without it the
    /// app cannot tell an unearned slot from one that will never be filled, and a two-photo profile
    /// shows a padlock on the third that no amount of conversation opens.
    /// </summary>
    int PhotoCount = 0);

public record UserDeepFields(
    bool? HasKids,
    string? SmokingHabit,
    string? DrinkingHabit,
    string? Religion,
    string? Lifestyle);
