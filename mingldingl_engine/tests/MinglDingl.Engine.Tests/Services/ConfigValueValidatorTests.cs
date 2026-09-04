namespace MinglDingl.Engine.Tests;

public class ConfigValueValidatorTests
{
    private static readonly ConfigKeyDefinition Bounded =
        new("test.bounded", "Test", "Number", "5", "bounded", Min: 0, Max: 10);

    [Theory]
    [InlineData("0")]
    [InlineData("10")]
    [InlineData("5.5")]
    public void Validate_WithinBounds_ReturnsNull(string value)
    {
        Assert.Null(ConfigValueValidator.Validate(Bounded, value));
    }

    [Theory]
    [InlineData("-1")]
    [InlineData("11")]
    public void Validate_OutsideBounds_ReturnsRangeError(string value)
    {
        var error = ConfigValueValidator.Validate(Bounded, value);
        Assert.NotNull(error);
        Assert.Contains("between 0 and 10", error);
        Assert.Contains("test.bounded", error);
    }

    [Fact]
    public void Validate_NotANumber_ReturnsTypeErrorBeforeBounds()
    {
        var error = ConfigValueValidator.Validate(Bounded, "abc");
        Assert.NotNull(error);
        Assert.Contains("not a valid number", error);
    }

    [Fact]
    public void Validate_UnboundedNumberDefinition_AcceptsAnyNumber()
    {
        var def = new ConfigKeyDefinition("test.free", "Test", "Number", "5", "free");
        Assert.Null(ConfigValueValidator.Validate(def, "-999999"));
    }

    [Fact]
    public void Validate_BoolDefinition_IgnoresBounds()
    {
        var def = new ConfigKeyDefinition("test.flag", "Test", "Bool", "true", "flag", Min: 0, Max: 1);
        Assert.Null(ConfigValueValidator.Validate(def, "false"));
        Assert.NotNull(ConfigValueValidator.Validate(def, "maybe"));
    }

    [Theory]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("-Infinity")]
    public void Validate_NonFiniteNumber_IsRejectedByBothOverloads(string value)
    {
        Assert.NotNull(ConfigValueValidator.Validate("Number", value));
        Assert.NotNull(ConfigValueValidator.Validate(Bounded, value));
    }

    [Fact]
    public void Validate_LegacyStringOverload_StillAcceptsAnyNumber()
    {
        Assert.Null(ConfigValueValidator.Validate("Number", "-5"));
    }

    [Fact]
    public void Validate_NumberUsesInvariantCulture()
    {
        Assert.Null(ConfigValueValidator.Validate("Number", "0.1"));
        Assert.NotNull(ConfigValueValidator.Validate("Number", "0,1"));
    }

    [Fact]
    public void AllRegistryDefaults_SitWithinTheirOwnBounds()
    {
        foreach (var def in ConfigKeys.All)
            Assert.True(ConfigValueValidator.Validate(def, def.DefaultValue) is null, def.Key);
    }

    [Fact]
    public void AllRegistryKeys_AreUnique()
    {
        Assert.Equal(ConfigKeys.All.Count, ConfigKeys.All.Select(d => d.Key).Distinct().Count());
    }
}
