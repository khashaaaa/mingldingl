namespace MinglDingl.Engine.Tests.Services;

public class MembershipPricingTests
{
    [Fact]
    public void PriceOptions_OneMonth_HasNoDiscount()
    {
        var options = MembershipPricing.PriceOptions(5900);
        var oneMonth = options.Single(o => o.DurationMonths == 1);

        Assert.Equal(5900, oneMonth.TotalPriceMnt);
        Assert.Equal(0, oneMonth.DiscountPct);
    }

    [Fact]
    public void PriceOptions_ThreeMonths_IsTenPercentOffTheThreeMonthTotal()
    {
        var options = MembershipPricing.PriceOptions(5900);
        var threeMonths = options.Single(o => o.DurationMonths == 3);

        // 5900 * 3 = 17700; 10% off = 15930
        Assert.Equal(15930, threeMonths.TotalPriceMnt);
        Assert.Equal(10, threeMonths.DiscountPct);
    }

    [Fact]
    public void PriceOptions_SixMonths_IsTwentyPercentOffTheSixMonthTotal()
    {
        var options = MembershipPricing.PriceOptions(12900);
        var sixMonths = options.Single(o => o.DurationMonths == 6);

        // 12900 * 6 = 77400; 20% off = 61920
        Assert.Equal(61920, sixMonths.TotalPriceMnt);
        Assert.Equal(20, sixMonths.DiscountPct);
    }

    [Fact]
    public void PriceOptions_ReturnsExactlyTheThreeAvailableDurations()
    {
        var options = MembershipPricing.PriceOptions(24900);

        Assert.Equal(new[] { 1, 3, 6 }, options.Select(o => o.DurationMonths).OrderBy(m => m));
    }
}
