/// <summary>
/// Picks the reader's language for authored content — icebreaker prompts, quiz questions and their
/// option lists, and venue name/category/district/description. Each of these tables holds one
/// stored column as the fallback and, optionally, a second column that overlays it for exactly one
/// other locale.
/// <para>
/// For icebreakers and quizzes, Mongolian is the market's language and therefore the stored column
/// and the fallback: an English string is an optional overlay, and its absence shows the Mongolian
/// rather than a blank. <c>BusinessPartners</c> is the mirror image — that table was seeded in
/// English before this scheme existed, so English is the stored fallback there and a Mongolian
/// column is the (currently unwritten, native-speaker-owed) overlay. <paramref name="overlayLocale"/>
/// says which locale the second column belongs to, and defaults to English for the common case.
/// </para>
/// </summary>
public static class LocalisedContent
{
    public const string MarketLocale = "mn";
    public const string EnglishLocale = "en";

    public static string Pick(string? locale, string fallback, string? overlay, string overlayLocale = EnglishLocale) =>
        locale == overlayLocale && !string.IsNullOrWhiteSpace(overlay) ? overlay : fallback;

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
