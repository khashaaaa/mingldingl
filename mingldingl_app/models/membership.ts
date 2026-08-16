import type { components } from '../lib/api/api.generated';

export interface MembershipPriceOption {
  durationMonths: number;
  totalPriceMnt: number;
  pricePerMonthMnt: number;
  discountPct: number;
}

export interface MembershipTier {
  level: string;
  dailyMatches: number;
  deepProfileView: boolean;
  monthlyPriceMnt: number | null;
  featureKeys: string[];
  prices: MembershipPriceOption[];
}

export interface MembershipMe {
  level: string;
  expiresAt: string | null;
}

export function parseMembershipTier(d: components['schemas']['MembershipTierResponse']): MembershipTier {
  return {
    level: d.level ?? '',
    dailyMatches: d.dailyMatches ?? 0,
    deepProfileView: d.deepProfileView ?? false,
    monthlyPriceMnt: d.monthlyPriceMnt ?? null,
    featureKeys: d.featureKeys ?? [],
    prices: (d.prices ?? []).map((p) => ({
      durationMonths: p.durationMonths ?? 0,
      totalPriceMnt: p.totalPriceMnt ?? 0,
      pricePerMonthMnt: p.pricePerMonthMnt ?? 0,
      discountPct: p.discountPct ?? 0,
    })),
  };
}

export function parseMembershipMe(d: components['schemas']['MembershipMeResponse']): MembershipMe {
  return {
    level: d.membershipLevel ?? 'Free',
    expiresAt: d.expiresAt ?? null,
  };
}
