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
}
