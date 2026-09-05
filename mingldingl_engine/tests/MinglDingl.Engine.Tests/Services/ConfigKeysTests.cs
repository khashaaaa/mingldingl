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
}
