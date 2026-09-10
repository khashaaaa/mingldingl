public class User
{
    public Guid Id { get; set; }

    public string? PhoneNumber { get; set; }
    public string DisplayName { get; set; } = "";
    public int Age { get; set; }
    public string Gender { get; set; } = "";
    public string City { get; set; } = "";

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string Bio { get; set; } = "";
    public List<string> PhotoUrls { get; set; } = [];
    public bool IsProfileComplete { get; set; }

    public bool? HasKids { get; set; }
    public string? SmokingHabit { get; set; }
    public string? DrinkingHabit { get; set; }
    public string? Religion { get; set; }
    public string? Lifestyle { get; set; }

    public string? Oath { get; set; }

    public DateTime? OathSwornAt { get; set; }

    public bool OathProven { get; set; }

    public int TotalScore { get; set; }
    public string GemTier { get; set; } = "Garnet";
    public decimal ReputationScore { get; set; } = 1.0m;

    public int NoShowFlagCount { get; set; }
    public string MembershipLevel { get; set; } = "Free";
    public DateTime? MembershipExpiresAt { get; set; }
    public int DailyMatchesUsed { get; set; }
    public DateTime DailyMatchesResetAt { get; set; } = DateTime.UtcNow.Date;
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateTime? LastLoginDate { get; set; }

    public string? EquippedTitleId { get; set; }

    public string? ReferralCode { get; set; }

    public DateTime? DeletionRequestedAt { get; set; }
    public bool IsDeleted { get; set; }

    public bool PushEnabled { get; set; } = true;

    /// <summary>"en" or "mn" — the language push notifications are written in; the app keeps it in step with its own locale.</summary>
    public string PreferredLocale { get; set; } = "en";

    public int AgeMin { get; set; } = 18;
    public int AgeMax { get; set; } = 99;

    public bool IsPaused { get; set; }

    public bool IsBanned { get; set; }
    public DateTime? BannedAt { get; set; }
    public string? BanReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScoreEvent> ScoreEvents { get; set; } = [];
    public ICollection<Match> InitiatedMatches { get; set; } = [];
    public ICollection<Match> ReceivedMatches { get; set; } = [];
}
