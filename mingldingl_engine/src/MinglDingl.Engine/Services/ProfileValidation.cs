/// <summary>
/// The profile fields whose value has to come from a known set rather than from whatever the client
/// sent. Each of these was free text, and each failure was silent rather than loud: an unknown
/// gender removed the account from every discovery feed, an invented city gave it a leaderboard of
/// one, and a foreign photo origin bypassed uploads entirely.
/// </summary>
public static class ProfileValidation
{
    /// <summary>The pair matching actually understands, and the pair onboarding offers.</summary>
    public static readonly IReadOnlySet<string> ValidGenders =
        new HashSet<string>(StringComparer.Ordinal) { "Male", "Female" };

    /// <summary>
    /// The optional profile fields, each limited to what the editor actually offers. They were free
    /// text, so a value with no translation stuck to the profile and rendered in chat as the raw
    /// key — [missing "en.habit_socially"] — in front of a real user. Kept in step with
    /// `app/edit-profile.tsx`'s option lists.
    /// </summary>
    public static readonly IReadOnlySet<string> ValidHabits =
        new HashSet<string>(StringComparer.Ordinal) { "Never", "Occasionally", "Regularly" };

    public static readonly IReadOnlySet<string> ValidReligions =
        new HashSet<string>(StringComparer.Ordinal) { "Buddhist", "Christian", "Muslim", "None", "Other" };

    public static readonly IReadOnlySet<string> ValidLifestyles =
        new HashSet<string>(StringComparer.Ordinal) { "Active", "Balanced", "Relaxed" };

    public static bool IsKnownGender(string? gender) =>
        gender is not null && ValidGenders.Contains(gender);

    public static bool IsKnownCity(string? city) =>
        city is not null && MongoliaGeo.AcceptedCityNames.Contains(city);
}
