public static class ConfigKeys
{
    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        new("tier.sapphire.threshold", "Scoring", "Number", "600",
            "Minimum total score for the Sapphire gem tier"),
        new("ships.daily.cap", "Growth", "Number", "3",
            "Max Fated Threads a single Weaver can create per day"),
        new("dating.noshow.threshold", "Safety", "Number", "3",
            "Distinct-match attendance mismatches before ReputationScore is docked"),
        new("oath.proven.encounters", "Scoring", "Number", "2",
            "Confirmed encounters required, since swearing, before an Oath shows as Proven"),
        new("dating.flamerite.duration_minutes", "Safety", "Number", "5",
            "Length of the Flame Rite video call, and the TTL of the token minted for it"),
        new("dating.flamerite.required", "Safety", "Bool", "true",
            "When true, a match cannot pledge an encounter until the Flame Rite is complete"),
    ];
}

public record ConfigKeyDefinition(string Key, string Category, string ValueType, string DefaultValue, string Description);
