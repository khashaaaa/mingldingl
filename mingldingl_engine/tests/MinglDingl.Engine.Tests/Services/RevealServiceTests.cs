namespace MinglDingl.Engine.Tests;

public class RevealServiceTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]   // match accepted → level 1
    [InlineData(5, 2)]   // 5 messages → level 2
    [InlineData(15, 3)]  // 15 messages → level 3
    [InlineData(30, 4)]  // 30 messages → level 4
    public void GetRevealLevel_ByMessageCount_ReturnsCorrectLevel(int messages, int expected)
    {
        var match = new Match { MessageCount = messages, Status = "Active" };
        Assert.Equal(expected, RevealService.GetRevealLevel(match));
    }

    [Fact]
    public void GetRevealLevel_GhostedMatch_FreezesAtCurrentLevel()
    {
        var match = new Match { MessageCount = 10, RevealLevel = 2, Status = "Ghosted" };
        Assert.Equal(2, RevealService.GetRevealLevel(match));
    }
}
