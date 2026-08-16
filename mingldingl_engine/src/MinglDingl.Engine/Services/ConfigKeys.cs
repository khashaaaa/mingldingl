// Declares every admin-editable config key up front. The admin UI only
// edits values for keys registered here — it can never invent a new key —
// so the config store can't become an untyped free-for-all. Add an entry
// here whenever a new value moves from a hardcoded constant to admin-
// editable config (a migration to seed the row is not required beyond
// what Program.cs's startup seed-if-missing loop already does).
public static class ConfigKeys
{
    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        new("tier.sapphire.threshold", "Scoring", "Number", "600",
            "Minimum total score for the Sapphire gem tier"),
        new("ships.daily.cap", "Growth", "Number", "3",
            "Max Fated Threads a single Weaver can create per day"),
    ];
}

public record ConfigKeyDefinition(string Key, string Category, string ValueType, string DefaultValue, string Description);
