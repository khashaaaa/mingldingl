public class RevealService
{
    public static int GetRevealLevel(Match match)
    {
        if (match.Status == "Ghosted") return match.RevealLevel;
        return LevelForMessageCount(match.MessageCount);
    }

    public static int LevelForMessageCount(int messageCount) => messageCount switch
    {
        0 => 0,
        < 5 => 1,
        < 15 => 2,
        < 30 => 3,
        _ => 4
    };
}
