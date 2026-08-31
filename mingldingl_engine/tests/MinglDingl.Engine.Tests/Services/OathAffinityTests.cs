namespace MinglDingl.Engine.Tests;

public class OathAffinityTests
{
    [Theory]
    [InlineData("Bond", "Bond", 2)]
    [InlineData("Fate", "Fate", 2)]
    [InlineData("Kinship", "Kinship", 2)]
    [InlineData("Bond", "Fate", 1)]
    [InlineData("Fate", "Bond", 1)]
    [InlineData("Fate", "Kinship", 1)]
    [InlineData("Kinship", "Fate", 1)]
    [InlineData("Bond", "Kinship", 0)]
    [InlineData("Kinship", "Bond", 0)]
    public void Affinity_KnownPairs_ScoresAsSpecified(string a, string b, int expected)
    {
        Assert.Equal(expected, OathService.Affinity(a, b));
    }

    [Theory]
    [InlineData(null, "Bond")]
    [InlineData("Bond", null)]
    [InlineData(null, null)]
    public void Affinity_EitherSideUnsworn_IsNull(string? a, string? b)
    {
        Assert.Null(OathService.Affinity(a, b));
    }

    [Fact]
    public void Affinity_IsSymmetric()
    {
        foreach (var a in OathService.ValidOaths)
            foreach (var b in OathService.ValidOaths)
                Assert.Equal(OathService.Affinity(a, b), OathService.Affinity(b, a));
    }
}
