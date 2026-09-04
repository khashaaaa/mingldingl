public static class MembershipPricing
{
    public static readonly int[] AvailableDurations = [1, 3, 6];

    private static readonly IReadOnlyDictionary<int, double> DefaultDiscountByDuration =
        new Dictionary<int, double> { [1] = 0.0, [3] = 0.10, [6] = 0.20 };

    public static IReadOnlyList<MembershipPriceOption> PriceOptions(int monthlyPriceMnt, IReadOnlyDictionary<int, double>? discountByDuration = null) =>
        AvailableDurations.Select(months =>
        {
            double discount = (discountByDuration ?? DefaultDiscountByDuration).GetValueOrDefault(months, 0.0);
            int total = (int)Math.Round(monthlyPriceMnt * months * (1 - discount));
            int perMonth = (int)Math.Round(total / (double)months);
            int discountPct = (int)Math.Round(discount * 100);
            return new MembershipPriceOption(months, total, perMonth, discountPct);
        }).ToList();
}
