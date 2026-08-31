public record MembershipTierResponse(string Level, int DailyMatches, bool DeepProfileView, int? MonthlyPriceMnt, string[] FeatureKeys, MembershipPriceOption[] Prices);

public record MembershipMeResponse(string MembershipLevel, DateTime? ExpiresAt);

public record UpgradeMembershipDto(string Level, int DurationMonths);

public record MembershipPriceOption(int DurationMonths, int TotalPriceMnt, int PricePerMonthMnt, int DiscountPct);
