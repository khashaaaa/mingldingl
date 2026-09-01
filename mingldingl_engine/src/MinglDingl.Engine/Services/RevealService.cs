public class RevealService
{
    /// <summary>
    /// Effective reveal level. <see cref="Match.RevealLevel"/> is the floor granted when the match
    /// was created (or frozen at, when ghosted); message volume can only raise it from there.
    /// </summary>
    public static int GetRevealLevel(Match match)
    {
        if (match.Status == "Ghosted") return match.RevealLevel;
        return Math.Max(match.RevealLevel, LevelForMessageCount(match.MessageCount));
    }

    /// <summary>
    /// Level earned purely by conversation volume, independent of the floor a match starts with.
    /// </summary>
    public static int LevelForMessageCount(int messageCount) => messageCount switch
    {
        0 => 0,
        < 5 => 1,
        < 15 => 2,
        < 30 => 3,
        _ => 4
    };
}
