/// <summary>
/// Progressive profile reveal: how much of a match's profile the other side may see, earned by how
/// much the two have actually said to each other. The thresholds are admin-tunable
/// (<c>reveal.levelN.messages</c>) because the right pace is a product question, not a constant.
/// </summary>
public static class RevealService
{
    /// <summary>
    /// Messages needed for each level above 0, in order; level 0 is "nothing said yet". The seeder
    /// reads this to register one config key per level, so adding a level here adds its key too.
    /// </summary>
    public static readonly (int Level, int DefaultMessages)[] Defaults =
        [(1, 1), (2, 5), (3, 15), (4, 30)];

    public static string ThresholdKey(int level) => $"reveal.level{level}.messages";

    public static (int Level, int Messages)[] EffectiveThresholds(ConfigService config) =>
        Defaults
            .Select(d => (Level: d.Level, Messages: (int)config.GetNumber(ThresholdKey(d.Level), d.DefaultMessages)))
            .ToArray();

    /// <summary>
    /// Effective reveal level. <see cref="Match.RevealLevel"/> is the floor granted when the match
    /// was created (or frozen at, when ghosted); message volume can only raise it from there.
    /// </summary>
    public static int GetRevealLevel(ConfigService config, Match match)
    {
        if (match.Status == "Ghosted") return match.RevealLevel;
        return Math.Max(match.RevealLevel, LevelForMessageCount(config, match.MessageCount));
    }

    /// <summary>
    /// Level earned purely by conversation volume, independent of the floor a match starts with.
    /// </summary>
    public static int LevelForMessageCount(ConfigService config, int messageCount)
    {
        int level = 0;
        foreach (var (candidate, needed) in EffectiveThresholds(config))
            if (messageCount >= needed) level = candidate;
        return level;
    }

    /// <summary>
    /// Null when <paramref name="value"/> keeps the ladder strictly increasing; otherwise the reason,
    /// so the admin sees why a threshold was refused. Out of order, a level becomes unreachable and a
    /// profile jumps two steps at once on a single message.
    /// </summary>
    public static string? ValidateThreshold(ConfigService config, string key, int value)
    {
        var table = EffectiveThresholds(config);
        int idx = Array.FindIndex(table, t => ThresholdKey(t.Level) == key);
        if (idx < 0) return null;

        int? lower = idx > 0 ? table[idx - 1].Messages : null;
        int? upper = idx < table.Length - 1 ? table[idx + 1].Messages : null;
        if ((lower is int l && value <= l) || (upper is int u && value >= u))
            return $"{key} must be between {lower?.ToString() ?? "0"} and {upper?.ToString() ?? "∞"} (exclusive) so reveal levels stay in order";
        return null;
    }
}
