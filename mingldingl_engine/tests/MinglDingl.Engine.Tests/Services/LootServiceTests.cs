namespace MinglDingl.Engine.Tests;

public class LootServiceTests
{
    [Fact]
    public void Catalog_HasSixteenUniqueItems()
    {
        Assert.Equal(16, LootService.Catalog.Count);
        Assert.Equal(16, LootService.Catalog.Select(c => c.Id).Distinct().Count());
    }

    [Fact]
    public void Catalog_OnlyValidRaritiesAndTypes()
    {
        Assert.All(LootService.Catalog, c => Assert.Contains(c.Rarity, new[] { "Common", "Rare", "Epic" }));
        Assert.All(LootService.Catalog, c => Assert.Contains(c.ItemType, new[] { "Frame", "Title", "Emblem" }));
    }

    [Fact]
    public void Catalog_HasEveryTypeAtEveryRarity()
    {
        foreach (var type in new[] { "Frame", "Title", "Emblem" })
        {
            Assert.Contains(LootService.Catalog, c => c.ItemType == type && c.Rarity == "Common");
            Assert.Contains(LootService.Catalog, c => c.ItemType == type && c.Rarity == "Epic");
        }
    }
}
