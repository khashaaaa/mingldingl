public record CandidateResponse(
    Guid Id,
    string DisplayName,
    int Age,
    string City,
    string GemTier,
    decimal ReputationScore,
    /// <summary>
    /// The first photo's blurred, small "sealed" variant — or null when it has none yet (an
    /// upload whose sealing hook failed, before the backfill sweep catches up). Never the real
    /// photo URLs: a candidate is a stranger who has not been matched, and "faces are earned" means
    /// the full likeness must not cross the wire until they have been.
    /// </summary>
    string? SealedPhotoUrl,
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
    bool VideoEnabled = true,
    /// <summary>
    /// When the match was made. The app's letters count their days from it ("The third day"), so
    /// a thread's first heading is the day of the summons, not the day of the first word.
    /// </summary>
    DateTime? CreatedAt = null,
    /// <summary>When the last letter was sent and by whom, so the app can say whose turn it is and
    /// how long a fire has been quiet without opening the thread. Null until the first letter.</summary>
    DateTime? LastMessageAt = null,
    Guid? LastMessageSenderId = null);

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
