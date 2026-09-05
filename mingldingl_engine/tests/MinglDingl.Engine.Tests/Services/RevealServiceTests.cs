namespace MinglDingl.Engine.Tests;

public class RevealServiceTests
{
    /// <summary>An empty cache means every key falls through to its registered default.</summary>
    private static ConfigService Config => new();

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(5, 2)]
    [InlineData(15, 3)]
    [InlineData(30, 4)]
    public void GetRevealLevel_ByMessageCount_ReturnsCorrectLevel(int messages, int expected)
    {
        var match = new Match { MessageCount = messages, Status = "Active" };
        Assert.Equal(expected, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void GetRevealLevel_GhostedMatch_FreezesAtCurrentLevel()
    {
        var match = new Match { MessageCount = 10, RevealLevel = 2, Status = "Ghosted" };
        Assert.Equal(2, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void GetRevealLevel_FreshMatchWithNoMessages_StillRevealsTheFirstTier()
    {
        // "Match accepted -> first name, 1 photo, short bio". NewMatch stores RevealLevel = 1,
        // which acts as the floor; recomputing from MessageCount alone used to return 0 and
        // leave a just-accepted match nameless and photoless.
        var match = new Match { Status = "Active", RevealLevel = 1, MessageCount = 0 };

        Assert.Equal(1, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void GetRevealLevel_MessageVolumeRaisesTheLevelAboveTheStoredFloor()
    {
        var match = new Match { Status = "Active", RevealLevel = 1, MessageCount = 20 };

        Assert.Equal(3, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void GetRevealLevel_StoredFloorOfZeroIsStillHonoured()
    {
        var match = new Match { Status = "Active", RevealLevel = 0, MessageCount = 0 };

        Assert.Equal(0, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void GetRevealLevel_GhostedMatchStaysFrozenEvenBelowWhatMessagesWouldEarn()
    {
        var match = new Match { Status = "Ghosted", RevealLevel = 2, MessageCount = 100 };

        Assert.Equal(2, RevealService.GetRevealLevel(Config, match));
    }

    [Fact]
    public void LevelForMessageCount_HonoursAdminTunedThresholds()
    {
        var config = new ConfigService();
        config.Set(RevealService.ThresholdKey(2), "3");
        config.Set(RevealService.ThresholdKey(3), "6");

        Assert.Equal(1, RevealService.LevelForMessageCount(config, 2));
        Assert.Equal(2, RevealService.LevelForMessageCount(config, 3));
        Assert.Equal(3, RevealService.LevelForMessageCount(config, 6));
        // Level 4 was left alone, so it still needs its default 30.
        Assert.Equal(3, RevealService.LevelForMessageCount(config, 29));
        Assert.Equal(4, RevealService.LevelForMessageCount(config, 30));
    }

    [Fact]
    public void ValidateThreshold_RejectsAValueThatWouldPassTheLevelAbove()
    {
        Assert.NotNull(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(2), 15));
        Assert.NotNull(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(2), 20));
    }

    [Fact]
    public void ValidateThreshold_RejectsAValueThatWouldFallToOrBelowTheLevelBelow()
    {
        Assert.NotNull(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(3), 5));
        Assert.NotNull(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(3), 2));
    }

    [Fact]
    public void ValidateThreshold_AcceptsAValueThatKeepsTheLadderIncreasing()
    {
        Assert.Null(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(3), 10));
        // The top level has no ceiling above it.
        Assert.Null(RevealService.ValidateThreshold(Config, RevealService.ThresholdKey(4), 1000));
    }

    [Fact]
    public void ValidateThreshold_IgnoresAKeyThatIsNotOnTheLadder()
    {
        Assert.Null(RevealService.ValidateThreshold(Config, "reveal.level9.messages", 1));
    }

    [Fact]
    public void EveryRevealThresholdIsRegisteredAsAdminConfig()
    {
        foreach (var (level, defaultMessages) in RevealService.Defaults)
        {
            var def = ConfigKeys.Find(RevealService.ThresholdKey(level));
            Assert.NotNull(def);
            Assert.Equal(defaultMessages.ToString(), def!.DefaultValue);
        }
    }
}
