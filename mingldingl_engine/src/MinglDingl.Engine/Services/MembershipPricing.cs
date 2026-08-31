public static class MembershipPricing
{
    public static readonly int[] AvailableDurations = [1, 3, 6];

    private static readonly IReadOnlyDictionary<int, double> DiscountByDuration =
        new Dictionary<int, double> { [1] = 0.0, [3] = 0.10, [6] = 0.20 };

    public static IReadOnlyList<MembershipPriceOption> PriceOptions(int monthlyPriceMnt) =>
        AvailableDurations.Select(months =>
        {
            double discount = DiscountByDuration[months];
            int total = (int)Math.Round(monthlyPriceMnt * months * (1 - discount));
            int perMonth = (int)Math.Round(total / (double)months);
            int discountPct = (int)Math.Round(discount * 100);
            return new MembershipPriceOption(months, total, perMonth, discountPct);
        }).ToList();
}
