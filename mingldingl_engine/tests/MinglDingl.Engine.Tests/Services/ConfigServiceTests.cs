namespace MinglDingl.Engine.Tests;

public class ConfigServiceTests
{
    [Fact]
    public void GetNumber_KeyNotSet_ReturnsDefault()
    {
        var config = new ConfigService();
        Assert.Equal(600, config.GetNumber("tier.sapphire.threshold", 600));
    }

    [Fact]
    public void GetNumber_KeySet_ReturnsStoredValue()
    {
        var config = new ConfigService();
        config.Set("tier.sapphire.threshold", "700");
        Assert.Equal(700, config.GetNumber("tier.sapphire.threshold", 600));
    }

    [Fact]
    public void GetBool_KeySet_ParsesStoredValue()
    {
        var config = new ConfigService();
        config.Set("flag.x", "true");
        Assert.True(config.GetBool("flag.x", false));
    }

    [Fact]
    public void GetString_KeyNotSet_ReturnsDefault()
    {
        var config = new ConfigService();
        Assert.Equal("fallback", config.GetString("missing.key", "fallback"));
    }

    [Fact]
    public void GetNumber_ParsesWithInvariantCultureAndRejectsNonFinite()
    {
        var config = new ConfigService();
        config.Set("a", "0.1");
        config.Set("b", "NaN");
        Assert.Equal(0.1, config.GetNumber("a", 9));
        Assert.Equal(9, config.GetNumber("b", 9));
    }

    [Fact]
    public void Set_OverwritesPreviousValue()
    {
        var config = new ConfigService();
        config.Set("tier.sapphire.threshold", "600");
        config.Set("tier.sapphire.threshold", "650");
        Assert.Equal(650, config.GetNumber("tier.sapphire.threshold", 0));
    }
}
