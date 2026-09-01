namespace MinglDingl.Engine.Tests;

public class RevealServiceTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(5, 2)]
    [InlineData(15, 3)]
    [InlineData(30, 4)]
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

    [Fact]
    public void GetRevealLevel_FreshMatchWithNoMessages_StillRevealsTheFirstTier()
    {
        // "Match accepted -> first name, 1 photo, short bio". NewMatch stores RevealLevel = 1,
        // which acts as the floor; recomputing from MessageCount alone used to return 0 and
        // leave a just-accepted match nameless and photoless.
        var match = new Match { Status = "Active", RevealLevel = 1, MessageCount = 0 };

        Assert.Equal(1, RevealService.GetRevealLevel(match));
    }

    [Fact]
    public void GetRevealLevel_MessageVolumeRaisesTheLevelAboveTheStoredFloor()
    {
        var match = new Match { Status = "Active", RevealLevel = 1, MessageCount = 20 };

        Assert.Equal(3, RevealService.GetRevealLevel(match));
    }

    [Fact]
    public void GetRevealLevel_StoredFloorOfZeroIsStillHonoured()
    {
        var match = new Match { Status = "Active", RevealLevel = 0, MessageCount = 0 };

        Assert.Equal(0, RevealService.GetRevealLevel(match));
    }

    [Fact]
    public void GetRevealLevel_GhostedMatchStaysFrozenEvenBelowWhatMessagesWouldEarn()
    {
        var match = new Match { Status = "Ghosted", RevealLevel = 2, MessageCount = 100 };

        Assert.Equal(2, RevealService.GetRevealLevel(match));
    }
}
