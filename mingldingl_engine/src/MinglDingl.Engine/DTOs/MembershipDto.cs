// FeatureKeys are stable identifiers (e.g. "deep_profile_view"), not display
// text — the client owns localization (EN/MN) via lib/i18n.ts, same pattern
// as quest/milestone nameKeys elsewhere. MonthlyPriceMnt is null for Free;
// the client formats currency + "/month" itself for the same reason.
public record MembershipTierResponse(string Level, int DailyMatches, bool DeepProfileView, int? MonthlyPriceMnt, string[] FeatureKeys, MembershipPriceOption[] Prices);

public record MembershipMeResponse(string MembershipLevel, DateTime? ExpiresAt);

public record UpgradeMembershipDto(string Level, int DurationMonths);

public record MembershipPriceOption(int DurationMonths, int TotalPriceMnt, int PricePerMonthMnt, int DiscountPct);
