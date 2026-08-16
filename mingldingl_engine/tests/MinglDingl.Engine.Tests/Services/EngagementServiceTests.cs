namespace MinglDingl.Engine.Tests;

public class EngagementServiceTests
{
    [Fact]
    public void CalculateCompatibility_AllSameAnswers_Returns100()
    {
        var q1 = Guid.NewGuid();
        var q2 = Guid.NewGuid();
        var r1 = new Dictionary<Guid, string> { [q1] = "A", [q2] = "B" };
        var r2 = new Dictionary<Guid, string> { [q1] = "A", [q2] = "B" };
        Assert.Equal(100, EngagementService.CalculateCompatibility(r1, r2));
    }

    [Fact]
    public void CalculateCompatibility_NoSameAnswers_Returns0()
    {
        var q1 = Guid.NewGuid();
        var r1 = new Dictionary<Guid, string> { [q1] = "A" };
        var r2 = new Dictionary<Guid, string> { [q1] = "B" };
        Assert.Equal(0, EngagementService.CalculateCompatibility(r1, r2));
    }

    [Fact]
    public void CalculateCompatibility_HalfMatch_Returns50()
    {
        var q1 = Guid.NewGuid(); var q2 = Guid.NewGuid();
        var r1 = new Dictionary<Guid, string> { [q1] = "A", [q2] = "B" };
        var r2 = new Dictionary<Guid, string> { [q1] = "A", [q2] = "C" };
        Assert.Equal(50, EngagementService.CalculateCompatibility(r1, r2));
    }
}
