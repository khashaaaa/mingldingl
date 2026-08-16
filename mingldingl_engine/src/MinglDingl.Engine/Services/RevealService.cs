public class RevealService
{
    public static int GetRevealLevel(Match match)
    {
        if (match.Status == "Ghosted") return match.RevealLevel;
        return match.MessageCount switch
        {
            0 => 0,
            < 5 => 1,
            < 15 => 2,
            < 30 => 3,
            _ => 4
        };
    }

    public static bool ShouldLevelUp(Match match)
    {
        int newLevel = GetRevealLevel(match);
        return newLevel > match.RevealLevel;
    }
}
