namespace MinglDingl.Engine.Tests;

public class MembershipCatalogTests
{
    [Fact]
    public void Tiers_NoConfig_ExposesFreeSilverGoldAtDesignPrices()
    {
        var tiers = new MembershipCatalog(new ConfigService()).Tiers();

        Assert.Equal(new[] { "Free", "Silver", "Gold" }, tiers.Select(t => t.Level));
        Assert.Null(tiers[0].MonthlyPriceMnt);
        Assert.Equal(10900, tiers[1].MonthlyPriceMnt);
        Assert.Equal(21900, tiers[2].MonthlyPriceMnt);
        Assert.Equal(new[] { 1, 3, 6 }, tiers[2].Prices.Select(p => p.DurationMonths));
        Assert.Equal(20, tiers[2].Prices.Single(p => p.DurationMonths == 6).DiscountPct);
    }

    [Fact]
    public void Tiers_PriceAndDiscountOverridden_RecomputesTotals()
    {
        var config = new ConfigService();
        config.Set("membership.gold.monthly_mnt", "25000");
        config.Set("membership.discount.6mo_pct", "30");

        var gold = new MembershipCatalog(config).Find("Gold")!;
        var sixMonths = gold.Prices.Single(p => p.DurationMonths == 6);

        Assert.Equal(25000, gold.MonthlyPriceMnt);
        Assert.Equal((int)Math.Round(25000 * 6 * 0.7), sixMonths.TotalPriceMnt);
        Assert.Equal(30, sixMonths.DiscountPct);
        Assert.Equal(0, gold.Prices.Single(p => p.DurationMonths == 1).DiscountPct);
    }

    [Fact]
    public void Tiers_DailyMatchesPerk_FollowsTheBudgetBaseKeys()
    {
        var config = new ConfigService();
        config.Set("budget.base.gold", "30");
        config.Set("budget.base.silver", "8");

        var tiers = new MembershipCatalog(config).Tiers();

        Assert.Equal(5, tiers.Single(t => t.Level == "Free").DailyMatches);
        Assert.Equal(8, tiers.Single(t => t.Level == "Silver").DailyMatches);
        Assert.Equal(30, tiers.Single(t => t.Level == "Gold").DailyMatches);
        Assert.Equal(30, new ScoreService(null!, config).DailyMatchBudget(new User { MembershipLevel = "Gold", TotalScore = 0 }));
    }

    [Fact]
    public void Find_UnknownLevel_ReturnsNull()
    {
        Assert.Null(new MembershipCatalog(new ConfigService()).Find("Platinum"));
    }
}
