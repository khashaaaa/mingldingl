namespace MinglDingl.Engine.Tests;

public class ScoreServiceTests
{
    private static ScoreService CreateService(ConfigService? config = null) =>
        new(null!, config ?? new ConfigService());

    [Fact]
    public void CalculateTier_SapphireThresholdOverridden_UsesConfigValue()
    {
        var config = new ConfigService();
        config.Set("tier.sapphire.threshold", "700");
        var score = CreateService(config);

        Assert.Equal("Amethyst", score.CalculateTier(650));
        Assert.Equal("Sapphire", score.CalculateTier(700));
    }

    [Theory]
    [InlineData("DailyLogin", 5)]
    [InlineData("FirstMessage", 10)]
    [InlineData("IcebreakerDone", 20)]
    [InlineData("QuizDone", 15)]
    [InlineData("MatchReply", 10)]
    [InlineData("DateConfirmed", 50)]
    [InlineData("VideoCallDone", 30)]
    [InlineData("ShipSparked", 40)]
    [InlineData("GhostPenalty", -15)]
    [InlineData("ReportPenalty", -30)]
    public void GetDelta_KnownEventType_ReturnsExpectedDelta(string eventType, int expected)
    {
        Assert.Equal(expected, ScoreService.GetDelta(eventType));
    }

    [Theory]
    [InlineData(0, "Free", 5)]
    [InlineData(100, "Free", 7)]     // 100 pts above tier min → +2 slots
    [InlineData(500, "Silver", 12)]  // Silver base=10, extra from score
    [InlineData(999, "Gold", 15)]    // Gold base=15, capped at Gold base here
    public void DailyMatchBudget_ReturnsCorrectSlots(int score, string membership, int expected)
    {
        var user = new User { TotalScore = score, MembershipLevel = membership };
        Assert.Equal(expected, ScoreService.DailyMatchBudget(user));
    }

    [Theory]
    [InlineData(0, "Garnet")]
    [InlineData(99, "Garnet")]
    [InlineData(100, "Opal")]
    [InlineData(600, "Sapphire")]
    [InlineData(2000, "Emerald")]
    public void CalculateTier_ReturnsExpectedTier(int score, string expected)
    {
        Assert.Equal(expected, CreateService().CalculateTier(score));
    }

    [Fact]
    public void IsProfileComplete_AllBasicFieldsFilled_ReturnsTrue()
    {
        var user = new User
        {
            DisplayName = "Munkh",
            Age = 28,
            Gender = "Male",
            City = "Ulaanbaatar",
            Bio = "Hi",
            PhotoUrls = ["url1", "url2", "url3"]
        };
        Assert.True(ScoreService.IsProfileComplete(user));
    }

    [Fact]
    public void IsProfileComplete_MissingPhotos_ReturnsFalse()
    {
        var user = new User { DisplayName = "A", Age = 25, Gender = "Female", City = "UB", Bio = "Hi" };
        Assert.False(ScoreService.IsProfileComplete(user));
    }

    [Fact]
    public void ComputeStreak_FirstLogin_Returns1() =>
        Assert.Equal(1, ScoreService.ComputeStreak(0, null, new DateTime(2026, 7, 4)));

    [Fact]
    public void ComputeStreak_ConsecutiveDay_Increments() =>
        Assert.Equal(4, ScoreService.ComputeStreak(3, new DateTime(2026, 7, 3), new DateTime(2026, 7, 4)));

    [Fact]
    public void ComputeStreak_SameDay_KeepsStreak() =>
        Assert.Equal(3, ScoreService.ComputeStreak(3, new DateTime(2026, 7, 4), new DateTime(2026, 7, 4)));

    [Fact]
    public void ComputeStreak_MissedTwoOrMoreDays_ResetsTo1() =>
        Assert.Equal(1, ScoreService.ComputeStreak(9, new DateTime(2026, 7, 1), new DateTime(2026, 7, 4)));

    [Fact]
    public void ComputeStreak_MissedExactlyOneDay_HalvesInsteadOfResetting() =>
        Assert.Equal(5, ScoreService.ComputeStreak(10, new DateTime(2026, 7, 2), new DateTime(2026, 7, 4)));

    [Fact]
    public void ComputeStreak_MissedExactlyOneDay_FloorsAndNeverGoesBelow1() =>
        Assert.Equal(1, ScoreService.ComputeStreak(1, new DateTime(2026, 7, 2), new DateTime(2026, 7, 4)));

    [Theory]
    [InlineData("Garnet", 0)]
    [InlineData("Opal", 1)]
    [InlineData("Amethyst", 2)]
    [InlineData("Sapphire", 3)]
    [InlineData("Ruby", 4)]
    [InlineData("Emerald", 5)]
    public void TierIndex_ReturnsExpectedIndex(string gemTier, int expected)
    {
        Assert.Equal(expected, ScoreService.TierIndex(gemTier));
    }

    [Theory]
    [InlineData(0, "Opal", 100, 0.0)]
    [InlineData(50, "Opal", 100, 50.0)]
    [InlineData(150, "Amethyst", 300, 25.0)]
    public void TierProgress_BelowMaxTier_ReturnsNextTierAndPct(int score, string expectedNextTier, int expectedThreshold, double expectedPct)
    {
        var (nextTier, nextThreshold, pct) = CreateService().TierProgress(score);
        Assert.Equal(expectedNextTier, nextTier);
        Assert.Equal(expectedThreshold, nextThreshold);
        Assert.Equal(expectedPct, pct);
    }

    [Fact]
    public void TierProgress_AtMaxTier_ReturnsNullNextTierAnd100Pct()
    {
        var (nextTier, nextThreshold, pct) = CreateService().TierProgress(2500);
        Assert.Null(nextTier);
        Assert.Null(nextThreshold);
        Assert.Equal(100.0, pct);
    }

    [Fact]
    public void DailyMatchBudget_AppliesFlatTierBonus_ToBaseAndCap()
    {
        // Free/0-score baseline (base=5, cap=20, score-bonus=0) plus Emerald's
        // +5 tier bonus on both sides: min(5+0+5, 20+5) = 10.
        var user = new User { TotalScore = 0, MembershipLevel = "Free", GemTier = "Emerald" };
        Assert.Equal(10, ScoreService.DailyMatchBudget(user));
    }

    [Fact]
    public void DailyMatchBudget_TierBonusRaisesCap_WhenScoreBonusWouldOtherwiseBeCapped()
    {
        // Same inputs as the existing Gold/999 case (base=15, cap=15, score-bonus=19,
        // previously capped at 15) but with GemTier="Ruby" (+4): cap becomes 19,
        // so the result shifts from 15 to 19 instead of staying capped at 15.
        var user = new User { TotalScore = 999, MembershipLevel = "Gold", GemTier = "Ruby" };
        Assert.Equal(19, ScoreService.DailyMatchBudget(user));
    }
}
