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
    public void Catalog_CarriesOnlyTheTwoUlziiMetals()
    {
        Assert.All(HonourService.Catalog, c => Assert.Contains(c.Rarity, new[] { HonourService.MetalGold, HonourService.MetalEmber }));
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_oathkeeper")!.Rarity);
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_flamekeeper")!.Rarity);
        Assert.Equal(HonourService.MetalEmber, HonourService.Find("title_sealbreaker")!.Rarity);
    }

    [Fact]
    public void TierFrames_OnePerGemTier_InTierOrder()
    {
        var tiers = ScoreService.DefaultTierTable.Select(t => t.Tier).ToList();
        Assert.Equal(tiers.Count, HonourService.TierFrames.Count);
        Assert.Equal(tiers.Select(HonourService.FrameIdForTier), HonourService.TierFrames.Select(f => f.Id));
        Assert.All(HonourService.TierFrames, f => Assert.Equal("Frame", f.ItemType));
        Assert.Equal("frame_garnet", HonourService.TierFrames[0].Id);
        Assert.Equal("Sapphire", HonourService.TierForFrame("frame_sapphire"));
        Assert.Null(HonourService.TierForFrame("frame_bronze_ring"));
    }

    [Fact]
    public void FrameUnlocked_FollowsTheTierLadder()
    {
        Assert.True(HonourService.FrameUnlocked("frame_garnet", "Garnet"));
        Assert.True(HonourService.FrameUnlocked("frame_opal", "Ruby"));
        Assert.False(HonourService.FrameUnlocked("frame_emerald", "Ruby"));
        Assert.False(HonourService.FrameUnlocked("frame_iron_thorns", "Emerald"));

        Assert.Equal(["frame_garnet", "frame_opal", "frame_amethyst"], HonourService.FramesUnlockedFor("Amethyst").Select(f => f.Id));
        Assert.Equal(["frame_sapphire", "frame_ruby", "frame_emerald"], HonourService.FrameIdsAbove("Amethyst"));
        Assert.Empty(HonourService.FrameIdsAbove("Emerald"));
    }

    [Fact]
    public void RetiredLootIds_AreGoneFromTheCatalog()
    {
        foreach (var retired in new[] { "title_wanderer", "title_icebreaker", "title_dragonheart", "emblem_torch", "emblem_phoenix", "frame_gold_crown" })
            Assert.Null(HonourService.Find(retired));
    }
}
