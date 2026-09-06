namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// Icebreakers and quizzes are the one thing in this app that was never bilingual: the tables held
/// a single Mongolian string, so an English-speaking user was handed Cyrillic prompts while every
/// push, screen and error around them was translated.
/// </summary>
public class LocalisedContentTests
{
    [Fact]
    public void AnEnglishReader_GetsTheEnglishText() =>
        Assert.Equal("What made you laugh?",
            LocalisedContent.Pick("en", "Юунд инээв?", "What made you laugh?"));

    [Fact]
    public void AMongolianReader_GetsTheMongolianTextEvenWhenEnglishExists() =>
        Assert.Equal("Юунд инээв?",
            LocalisedContent.Pick("mn", "Юунд инээв?", "What made you laugh?"));

    [Fact]
    public void AnEnglishReader_FallsBackToMongolianRatherThanShowingNothing() =>
        Assert.Equal("Юунд инээв?", LocalisedContent.Pick("en", "Юунд инээв?", null));

    [Fact]
    public void AnUntranslatedBlank_IsTreatedAsMissing() =>
        Assert.Equal("Юунд инээв?", LocalisedContent.Pick("en", "Юунд инээв?", "   "));

    [Fact]
    public void AnUnknownLocale_ReadsAsTheMarketLanguage() =>
        Assert.Equal("Юунд инээв?", LocalisedContent.Pick("ru", "Юунд инээв?", "What made you laugh?"));

    [Fact]
    public void OptionLists_FollowTheSameRule()
    {
        List<string> mn = ["Уул", "Далай"];
        List<string> en = ["Mountain", "Sea"];

        Assert.Equal(en, LocalisedContent.PickList("en", mn, en));
        Assert.Equal(mn, LocalisedContent.PickList("mn", mn, en));
        Assert.Equal(mn, LocalisedContent.PickList("en", mn, null));
    }

    /// <summary>A partial translation is worse than none: half a list in each language is unreadable.</summary>
    [Fact]
    public void AnOptionListOfTheWrongLength_IsRejectedWholesale() =>
        Assert.Equal(["Уул", "Далай"], LocalisedContent.PickList("en", ["Уул", "Далай"], ["Mountain"]));
}
