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
    [InlineData("OathProven", 40)]
    [InlineData("GhostPenalty", -15)]
    [InlineData("ReportPenalty", -30)]
    public void Delta_KnownEventType_ReturnsDesignTableValue(string eventType, int expected)
    {
        Assert.Equal(expected, CreateService().Delta(eventType));
    }

    [Fact]
    public void Delta_UnknownEventType_ReturnsZero()
    {
        Assert.Equal(0, CreateService().Delta("NoSuchEvent"));
    }

    [Fact]
    public void Delta_OverriddenInConfig_UsesConfigValue()
    {
        var config = new ConfigService();
        config.Set("score.event.MatchReply", "3");
        Assert.Equal(3, CreateService(config).Delta("MatchReply"));
        Assert.Equal(10, CreateService(config).Delta("FirstMessage"));
    }

    [Fact]
    public void WeeklyStreakBonusAndQuestChest_OverriddenInConfig_UseConfigValues()
    {
        var config = new ConfigService();
        config.Set("score.streak.weekly_bonus", "75");
        config.Set("score.quest_chest", "45");
        var score = CreateService(config);
        Assert.Equal(75, score.WeeklyStreakBonus);
        Assert.Equal(45, score.QuestChestXp);
        Assert.Equal(50, CreateService().WeeklyStreakBonus);
        Assert.Equal(30, CreateService().QuestChestXp);
    }

    [Fact]
    public void DailyMatchBudget_ConfigOverrides_ChangeBaseAndCap()
    {
        var config = new ConfigService();
        config.Set("budget.base.free", "8");
        config.Set("budget.cap.free", "9");
        var score = CreateService(config);

        Assert.Equal(8, score.DailyMatchBudget(new User { TotalScore = 0, MembershipLevel = "Free" }));
        Assert.Equal(9, score.DailyMatchBudget(new User { TotalScore = 500, MembershipLevel = "Free" }));
    }

    [Fact]
    public void DailyMatchBudget_ScoreDivisorOverridden_ChangesBonusRate()
    {
        var config = new ConfigService();
        config.Set("budget.score_divisor", "10");
        Assert.Equal(12, CreateService(config).DailyMatchBudget(new User { TotalScore = 100, MembershipLevel = "Free" }));
    }

    [Fact]
    public void CalculateTier_RubyThresholdOverridden_UsesConfigValue()
    {
        var config = new ConfigService();
        config.Set("tier.ruby.threshold", "900");
        var score = CreateService(config);
        Assert.Equal("Sapphire", score.CalculateTier(899));
        Assert.Equal("Ruby", score.CalculateTier(900));
    }

    [Theory]
    [InlineData("tier.sapphire.threshold", 250, false)]
    [InlineData("tier.sapphire.threshold", 300, false)]
    [InlineData("tier.sapphire.threshold", 1000, false)]
    [InlineData("tier.sapphire.threshold", 999, true)]
    [InlineData("tier.sapphire.threshold", 301, true)]
    [InlineData("tier.emerald.threshold", 1001, true)]
    [InlineData("tier.emerald.threshold", 1000, false)]
    [InlineData("tier.opal.threshold", 0, false)]
    [InlineData("tier.opal.threshold", 1, true)]
    public void ValidateTierThreshold_EnforcesStrictOrdering(string key, int value, bool accepted)
    {
        var error = CreateService().ValidateTierThreshold(key, value);
        Assert.Equal(accepted, error is null);
    }

    [Fact]
    public void ValidateTierThreshold_GarnetFloor_IsRefused()
    {
        Assert.NotNull(CreateService().ValidateTierThreshold("tier.garnet.threshold", 5));
    }

    [Fact]
    public void ValidateTierThreshold_UnknownKey_ReturnsNull()
    {
        Assert.Null(CreateService().ValidateTierThreshold("tier.platinum.threshold", 5));
    }

    [Theory]
    [InlineData(0, "Free", 5)]
    [InlineData(100, "Free", 7)]
    [InlineData(500, "Silver", 22)]
    [InlineData(0, "Gold", 20)]
    [InlineData(999, "Gold", 39)]
    public void DailyMatchBudget_ReturnsCorrectSlots(int score, string membership, int expected)
    {
        var user = new User { TotalScore = score, MembershipLevel = membership };
        Assert.Equal(expected, CreateService().DailyMatchBudget(user));
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

    [Fact]
    public void DisplayStreak_NeverLoggedIn_ReturnsStoredValue() =>
        Assert.Equal(0, ScoreService.DisplayStreak(0, null, new DateTime(2026, 7, 4)));

    [Fact]
    public void DisplayStreak_LoggedInToday_ReturnsStoredValue() =>
        Assert.Equal(3, ScoreService.DisplayStreak(3, new DateTime(2026, 7, 4), new DateTime(2026, 7, 4)));

    [Fact]
    public void DisplayStreak_LoggedInYesterday_StreakStillAlive_NoIncrement() =>
        Assert.Equal(3, ScoreService.DisplayStreak(3, new DateTime(2026, 7, 3), new DateTime(2026, 7, 4)));

    [Fact]
    public void DisplayStreak_MissedExactlyOneDay_Halves() =>
        Assert.Equal(5, ScoreService.DisplayStreak(10, new DateTime(2026, 7, 2), new DateTime(2026, 7, 4)));

    [Fact]
    public void DisplayStreak_MissedTwoOrMoreDays_DecaysToFloor() =>
        Assert.Equal(1, ScoreService.DisplayStreak(30, new DateTime(2026, 7, 1), new DateTime(2026, 7, 4)));

    [Fact]
    public void DisplayStreak_LapsedWithNoStreak_StaysZero() =>
        Assert.Equal(0, ScoreService.DisplayStreak(0, new DateTime(2026, 7, 1), new DateTime(2026, 7, 4)));

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
        var user = new User { TotalScore = 0, MembershipLevel = "Free", GemTier = "Emerald" };
        Assert.Equal(10, CreateService().DailyMatchBudget(user));
    }

    [Fact]
    public void DailyMatchBudget_TierBonusRaisesCap_WhenScoreBonusWouldOtherwiseBeCapped()
    {
        var user = new User { TotalScore = 2000, MembershipLevel = "Gold", GemTier = "Ruby" };
        Assert.Equal(44, CreateService().DailyMatchBudget(user));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(300)]
    [InlineData(400)]
    [InlineData(600)]
    [InlineData(750)]
    [InlineData(2000)]
    public void DailyMatchBudget_PaidTiersNeverFallBelowFree(int score)
    {
        int Budget(string level) =>
            CreateService().DailyMatchBudget(new User { TotalScore = score, MembershipLevel = level });

        int free = Budget("Free");
        Assert.True(Budget("Silver") > free,
            $"Silver ({Budget("Silver")}) must beat Free ({free}) at score {score}");
        Assert.True(Budget("Gold") > Budget("Silver"),
            $"Gold ({Budget("Gold")}) must beat Silver ({Budget("Silver")}) at score {score}");
    }
}
