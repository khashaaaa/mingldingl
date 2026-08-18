public class User
{
    public Guid Id { get; set; }           // matches Supabase auth.users.id
    // Fake-OTP auth mints a new Supabase auth id per login (no real SMS
    // verification), so this is the stable cross-session identity anchor
    // CurrentUserMiddleware aliases a returning auth id back to.
    public string? PhoneNumber { get; set; }
    public string DisplayName { get; set; } = "";
    public int Age { get; set; }
    public string Gender { get; set; } = "";
    public string City { get; set; } = "";
    // Raw GPS coordinates, distinct from City (which is a human-readable label
    // snapped to the nearest MongoliaGeo.Cities entry). Used for Discover's
    // distance sort — null until the user has granted location permission at
    // least once.
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string Bio { get; set; } = "";
    public List<string> PhotoUrls { get; set; } = [];
    public bool IsProfileComplete { get; set; }

    // deep fields (membership-gated)
    public bool? HasKids { get; set; }
    public string? SmokingHabit { get; set; }
    public string? DrinkingHabit { get; set; }
    public string? Religion { get; set; }
    public string? Lifestyle { get; set; }

    public int TotalScore { get; set; }
    public string GemTier { get; set; } = "Garnet"; // Garnet|Opal|Amethyst|Sapphire|Ruby|Emerald
    public decimal ReputationScore { get; set; } = 1.0m;

    // Times this user was the non-confirming/denying side of an attendance
    // mismatch, across *distinct* matches (DateConfirmation.PenaltyApplied
    // enforces the distinctness) — see ActivityService.SubmitAttendanceAsync.
    // Only crossing NoShowThreshold (ConfigKeys "dating.noshow.threshold")
    // actually docks ReputationScore; this raw count is tracked unconditionally.
    public int NoShowFlagCount { get; set; }
    public string MembershipLevel { get; set; } = "Free"; // Free|Silver|Gold|Platinum
    public DateTime? MembershipExpiresAt { get; set; } // null = no active paid period
    public int DailyMatchesUsed { get; set; }
    public DateTime DailyMatchesResetAt { get; set; } = DateTime.UtcNow.Date;
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateTime? LastLoginDate { get; set; }

    public string? EquippedFrameId { get; set; }
    public string? EquippedTitleId { get; set; }

    // Lazily generated on first GET /users/me — see ReferralService.
    // 6 chars, uppercase, ambiguous characters excluded.
    public string? ReferralCode { get; set; }

    // Set when the user requests deletion; cleared automatically the next
    // time they successfully load their own profile (UsersController.GetMe)
    // — a 7-day "log back in to cancel" grace period, no separate cancel
    // endpoint needed. DailyMaintenanceBackgroundService anonymizes anyone
    // whose request is older than 7 days and sets IsDeleted, at which point
    // this field is left set permanently (the row itself is never removed,
    // so matches/messages the other party has stay intact).
    public DateTime? DeletionRequestedAt { get; set; }
    public bool IsDeleted { get; set; }

    // Server-side gate for push (see PushNotificationService.NotifyUserAsync)
    // — a per-account preference, not per-device, so it survives reinstalls.
    public bool PushEnabled { get; set; } = true;

    // What age range of candidates this user wants to see in GetCandidates —
    // a one-directional preference (not mutually checked against the
    // candidate's own range). 18/99 defaults effectively mean "no filter".
    public int AgeMin { get; set; } = 18;
    public int AgeMax { get; set; } = 99;

    // Hides this user from GetCandidates without the 7-day deletion pipeline
    // — a reversible "take a break," existing matches/chats stay untouched.
    public bool IsPaused { get; set; }

    // Admin moderation action (mingldingl_control) — distinct from IsPaused
    // (self-serve, reversible break) and the deletion pipeline (user-initiated,
    // auto-anonymizes). A banned user is rejected at auth time (see
    // CurrentUserMiddleware) rather than merely hidden from discovery.
    public bool IsBanned { get; set; }
    public DateTime? BannedAt { get; set; }
    public string? BanReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScoreEvent> ScoreEvents { get; set; } = [];
    public ICollection<Match> InitiatedMatches { get; set; } = [];
    public ICollection<Match> ReceivedMatches { get; set; } = [];
}
