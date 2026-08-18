namespace MinglDingl.Engine.Tests;

public class MilestoneServiceTests
{
    [Fact]
    public void Defs_HasSixUniqueMilestonesWithPositiveXp()
    {
        Assert.Equal(6, MilestoneService.Defs.Count);
        Assert.Equal(6, MilestoneService.Defs.Select(d => d.Id).Distinct().Count());
        Assert.All(MilestoneService.Defs, d => Assert.True(d.Xp > 0));
    }
}
