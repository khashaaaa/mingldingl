/// <summary>
/// One person's report of another. Kept even after it is resolved: a pattern across several
/// reporters is the signal moderation actually acts on, and a single dismissed report is part of
/// that pattern.
/// </summary>
public class UserReport
{
    public Guid Id { get; set; }
    public Guid ReporterId { get; set; }
    public Guid ReportedUserId { get; set; }

    /// <summary>The conversation it came from, when there was one. Town Square reports have none.</summary>
    public Guid? MatchId { get; set; }

    /// <summary>One of <see cref="ReportReasons.All"/>.</summary>
    public string Reason { get; set; } = "";

    /// <summary>What the reporter typed, if anything.</summary>
    public string? Details { get; set; }

    /// <summary>Pending, Dismissed, Warned, Penalised or Banned — see <see cref="ReportOutcomes"/>.</summary>
    public string Status { get; set; } = ReportOutcomes.Pending;

    public string? ReviewNotes { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Reporter { get; set; }
    public User? ReportedUser { get; set; }
}

/// <summary>
/// The reasons a report may carry. Wire values, never shown to anyone: both frontends localise
/// from them, so adding one means adding copy on both locales in <c>lib/i18n/</c>.
/// </summary>
public static class ReportReasons
{
    public const string Harassment = "Harassment";
    public const string InappropriatePhotos = "InappropriatePhotos";
    public const string FakeProfile = "FakeProfile";
    public const string Scam = "Scam";
    public const string Underage = "Underage";
    public const string OffPlatformHarm = "OffPlatformHarm";
    public const string Other = "Other";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Harassment, InappropriatePhotos, FakeProfile, Scam, Underage, OffPlatformHarm, Other,
    };
}

/// <summary>Where a report can end up. <see cref="Pending"/> is the only unresolved one.</summary>
public static class ReportOutcomes
{
    public const string Pending = "Pending";
    public const string Dismissed = "Dismissed";
    public const string Warned = "Warned";
    public const string Penalised = "Penalised";
    public const string Banned = "Banned";

    public static readonly IReadOnlySet<string> Resolutions = new HashSet<string>(StringComparer.Ordinal)
    {
        Dismissed, Warned, Penalised, Banned,
    };
}
