namespace MinglDingl.Engine.Tests.Services;

public class HonourServiceTests
{
    [Fact]
    public void Honours_AreNineUniqueTitles()
    {
        Assert.Equal(9, HonourService.Honours.Count);
        Assert.Equal(9, HonourService.Honours.Select(c => c.Id).Distinct().Count());
        Assert.All(HonourService.Honours, h => Assert.Equal("Title", h.ItemType));
    }

    [Fact]
    public void Honours_CarryOnlyTheTwoUlziiMetals()
    {
        Assert.All(HonourService.Honours, c => Assert.Contains(c.Rarity, new[] { HonourService.MetalGold, HonourService.MetalEmber }));
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_oathkeeper")!.Rarity);
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_flamekeeper")!.Rarity);
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_sealbreaker")!.Rarity);
    }

    [Fact]
    public void Find_KnowsOnlyTheNineHonours()
    {
        Assert.NotNull(HonourService.Find("title_sevendawns"));
        Assert.Null(HonourService.Find(null));
        // Retired loot and the tier rings retired after it are equally unknown to the catalogue.
        foreach (var retired in new[] { "title_wanderer", "title_icebreaker", "title_dragonheart", "emblem_torch", "emblem_phoenix", "frame_gold_crown", "frame_garnet", "frame_emerald" })
            Assert.Null(HonourService.Find(retired));
    }
}
