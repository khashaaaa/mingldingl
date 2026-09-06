/// <summary>
/// Picks the reader's language for authored content — icebreaker prompts, quiz questions and their
/// option lists. These tables held one Mongolian string each, so an <c>en</c> user was handed
/// Cyrillic while every push, screen and error code around them was translated.
/// <para>
/// Mongolian is the market's language and therefore the stored column and the fallback: an English
/// string is an optional overlay, and its absence shows the Mongolian rather than a blank.
/// </para>
/// </summary>
public static class LocalisedContent
{
    public const string MarketLocale = "mn";
    public const string EnglishLocale = "en";

    public static string Pick(string? locale, string mongolian, string? english) =>
        locale == EnglishLocale && !string.IsNullOrWhiteSpace(english) ? english : mongolian;

    /// <summary>
    /// The same rule for a list of choices, with one extra condition: a translation of the wrong
    /// length is refused outright. Falling back element by element would render half the answers in
    /// each language, which reads as corruption rather than as a missing translation.
    /// </summary>
    public static List<string> PickList(string? locale, List<string> mongolian, List<string>? english) =>
        locale == EnglishLocale
            && english is not null
            && english.Count == mongolian.Count
            && english.All(o => !string.IsNullOrWhiteSpace(o))
                ? english
                : mongolian;
}
