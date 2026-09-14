namespace MinglDingl.Engine.Tests.Services;

public class ConfigKeysTests
{
    [Fact]
    public void All_CarriesTheActivitySuggestionThreshold_DefaultingToFifteen()
    {
        var def = Assert.Single(ConfigKeys.All, d => d.Key == "activity.suggestions.messages");

        Assert.Equal("15", def.DefaultValue);
        Assert.Equal("Matching", def.Category);
        Assert.Equal(1, def.Min);
    }

    /// <summary>ReputationScore is numeric(4,2), so a dock below 0.01 rounded away to no dock at all.</summary>
    [Fact]
    public void ReputationPenaltyDock_RefusesADockTooSmallToSurviveTwoDecimalRounding()
    {
        var def = Assert.Single(ConfigKeys.All, d => d.Key == "reputation.penalty_dock");

        Assert.NotNull(ConfigValueValidator.Validate(def, "0.001"));
        Assert.NotNull(ConfigValueValidator.Validate(def, "0"));
        Assert.Null(ConfigValueValidator.Validate(def, "0.01"));
    }
}
