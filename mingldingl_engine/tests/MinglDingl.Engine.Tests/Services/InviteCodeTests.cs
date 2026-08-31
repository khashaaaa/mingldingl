namespace MinglDingl.Engine.Tests.Services;

public class InviteCodeTests
{
    [Fact]
    public void Alphabet_HasNoDuplicateCharacters()
    {
        Assert.Equal(InviteCode.Alphabet.Length, InviteCode.Alphabet.Distinct().Count());
    }

    [Fact]
    public void Alphabet_IsUppercaseLettersAndDigitsOnly()
    {
        Assert.All(InviteCode.Alphabet, c => Assert.True(char.IsAsciiLetterUpper(c) || char.IsAsciiDigit(c), $"'{c}'"));
    }

    [Theory]
    [InlineData('I')]
    [InlineData('L')]
    [InlineData('O')]
    [InlineData('0')]
    [InlineData('1')]
    public void Alphabet_ExcludesVisuallyAmbiguousCharacters(char ambiguous)
    {
        Assert.DoesNotContain(ambiguous, InviteCode.Alphabet);
    }

    [Fact]
    public void Alphabet_Has31Symbols()
    {
        Assert.Equal(31, InviteCode.Alphabet.Length);
    }
}
