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
        // Split evenly: these cases describe a balanced conversation of `messages` total, which is
        // what the ladder has always been documented to measure.
        var match = new Match
        {
            MessageCount = messages, Status = "Active",
            InitiatorMessageCount = messages - messages / 2, ReceiverMessageCount = messages / 2,
        };
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
        var match = new Match
        {
            Status = "Active", RevealLevel = 1, MessageCount = 20,
            InitiatorMessageCount = 10, ReceiverMessageCount = 10,
        };

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

    /// <summary>
    /// The ladder is meant to be "earned by how much the two have actually said to each other".
    /// Reading the combined count alone let one person spend 30 messages into silence and unlock a
    /// stranger's age, district and both locked photos, which is the whole mechanic defeated.
    /// A conversation counts only as far as the quieter side has matched it.
    /// </summary>
    [Fact]
    public void GetRevealLevel_OnlyOneSideHasEverSpoken_StaysAtTheFloor()
    {
        var config = new ConfigService();
        var match = new Match
        {
            Status = "Active",
            RevealLevel = 1,
            InitiatorMessageCount = 30,
            ReceiverMessageCount = 0,
            MessageCount = 30,
        };

        Assert.Equal(1, RevealService.GetRevealLevel(config, match));
    }

    [Fact]
    public void GetRevealLevel_BalancedConversation_ReachesTheSameLevelAsBefore()
    {
        var config = new ConfigService();
        var match = new Match
        {
            Status = "Active",
            RevealLevel = 1,
            InitiatorMessageCount = 15,
            ReceiverMessageCount = 15,
            MessageCount = 30,
        };

        Assert.Equal(4, RevealService.GetRevealLevel(config, match));
    }

    [Fact]
    public void GetRevealLevel_LopsidedConversation_CountsOnlyAsFarAsTheQuieterSide()
    {
        var config = new ConfigService();
        // 25 and 5: the pair have genuinely exchanged 5 each, so the ladder sees 10, not 30.
        var match = new Match
        {
            Status = "Active",
            RevealLevel = 1,
            InitiatorMessageCount = 25,
            ReceiverMessageCount = 5,
            MessageCount = 30,
        };

        Assert.Equal(2, RevealService.GetRevealLevel(config, match));
    }

    [Theory]
    [InlineData(15, 15, 30, 30)]  // balanced: the whole conversation counts
    [InlineData(3, 2, 5, 5)]      // one ahead is still a conversation
    [InlineData(25, 5, 30, 11)]   // lopsided: capped just past the quieter side
    [InlineData(30, 0, 30, 1)]    // a monologue never counts as more than its first message
    public void MutualMessageCount_LetsYouLeadByOneMessageAndNoMore(int a, int b, int total, int expected) =>
        Assert.Equal(expected, RevealService.MutualMessageCount(
            new Match { InitiatorMessageCount = a, ReceiverMessageCount = b, MessageCount = total }));
}
