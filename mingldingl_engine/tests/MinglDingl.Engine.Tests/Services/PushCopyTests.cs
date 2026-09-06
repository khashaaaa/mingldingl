namespace MinglDingl.Engine.Tests;

public class PushCopyTests
{
    [Fact]
    public void For_SubstitutesEachPlaceholderWithItsArgument()
    {
        var (title, body) = PushCopy.For(PushKind.NewMessage, "en", "Bat", "Sain uu");

        Assert.Equal("Bat", title);
        Assert.Equal("Sain uu", body);
    }

    /// <summary>
    /// A display name is user-controlled. Substituting left to right in one pass keeps a name that
    /// happens to contain `{1}` from pulling the message body into the push title.
    /// </summary>
    [Fact]
    public void For_ArgumentContainingAPlaceholder_IsNotItselfSubstituted()
    {
        var (title, body) = PushCopy.For(PushKind.NewMessage, "en", "{1}", "a private message");

        Assert.Equal("{1}", title);
        Assert.Equal("a private message", body);
    }

    [Fact]
    public void For_UnknownLocale_FallsBackToEnglish()
    {
        var (title, _) = PushCopy.For(PushKind.NewMatch, "ru");

        Assert.Equal(PushCopy.For(PushKind.NewMatch, "en").Title, title);
    }

    /// <summary>
    /// Every kind must carry both languages and a wire type: Mongolian is the market's language,
    /// and the app routes on the type. A new kind added without them fails here rather than
    /// reaching a user as an English string or an unroutable notification.
    /// </summary>
    [Fact]
    public void EveryKind_HasBothLanguagesAndAWireType()
    {
        foreach (PushKind kind in Enum.GetValues<PushKind>())
        {
            var (enTitle, enBody) = PushCopy.For(kind, "en");
            var (mnTitle, mnBody) = PushCopy.For(kind, "mn");

            Assert.False(string.IsNullOrWhiteSpace(enTitle), $"{kind} has no English title");
            Assert.False(string.IsNullOrWhiteSpace(enBody), $"{kind} has no English body");
            Assert.False(string.IsNullOrWhiteSpace(mnTitle), $"{kind} has no Mongolian title");
            Assert.False(string.IsNullOrWhiteSpace(mnBody), $"{kind} has no Mongolian body");
            Assert.False(string.IsNullOrWhiteSpace(PushCopy.WireType(kind)), $"{kind} has no wire type");

            // Copy that is nothing but a placeholder — NewMessage's title is the sender's name —
            // is rightly identical in both languages. Anything with words of its own must differ,
            // which is what catches an English string left sitting in the Mongolian table.
            AssertTranslated(kind, "title", enTitle, mnTitle);
            AssertTranslated(kind, "body", enBody, mnBody);
        }
    }

    /// <summary>
    /// The party who let the thread die is told that it cost them. Both sides used to get the same
    /// neutral "a match went quiet", so the score and reputation simply dropped with no explanation
    /// anywhere — in an app whose whole premise is accountability.
    /// </summary>
    [Fact]
    public void TheGhostAndTheGhosted_AreToldDifferentThings()
    {
        var ghosted = PushCopy.For(PushKind.MatchGhosted, "en");
        var atFault = PushCopy.For(PushKind.MatchGhostedByYou, "en");

        Assert.NotEqual(ghosted.Body, atFault.Body);
        Assert.NotEqual(PushCopy.For(PushKind.MatchGhosted, "mn").Body,
                        PushCopy.For(PushKind.MatchGhostedByYou, "mn").Body);
    }

    private static void AssertTranslated(PushKind kind, string field, string en, string mn)
    {
        if (System.Text.RegularExpressions.Regex.Replace(en, @"\{\d+\}", "").Trim().Length == 0) return;
        Assert.False(en == mn, $"{kind} {field} is untranslated: both languages read \"{en}\"");
    }
}
