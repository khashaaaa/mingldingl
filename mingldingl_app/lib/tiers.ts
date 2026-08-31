import type { GemTier } from '../models/user';

export const TIER_ORDER: GemTier[] = ['Garnet', 'Opal', 'Amethyst', 'Sapphire', 'Ruby', 'Emerald'];

const DEFAULT_TIER_THRESHOLDS = [0, 100, 300, 600, 1000, 2000];
let tierThresholds: number[] = DEFAULT_TIER_THRESHOLDS;
let hydrated = false;

export function hydrateTierThresholds(raw: readonly { tier?: string | null; minScore?: number }[]): void {
  const byTier = new Map(raw.map((t) => [t.tier, t.minScore]));
  const ordered = TIER_ORDER.map((tier) => byTier.get(tier));
  if (ordered.some((v) => typeof v !== 'number')) return;
  tierThresholds = ordered as number[];
  hydrated = true;
}

export function areTierThresholdsHydrated(): boolean {
  return hydrated;
}

export const TIER_COLORS: Record<GemTier, string> = {
  Garnet:   '#C23B54',
  Opal:     '#3DEFDB',
  Amethyst: '#A855F7',
  Sapphire: '#2D6CDF',
  Ruby:     '#E0115F',
  Emerald:  '#2ECC71',
};

export const TIER_SHADES: Record<GemTier, string> = {
  Garnet:   '#5C0F22',
  Opal:     '#0E6E68',
  Amethyst: '#4C1D82',
  Sapphire: '#0A2F6E',
  Ruby:     '#6E0630',
  Emerald:  '#0B5A32',
};

export function colorForTier(tier: string): string {
  return TIER_COLORS[tier as GemTier] ?? TIER_COLORS.Garnet;
}

export function shadeForTier(tier: string): string {
  return TIER_SHADES[tier as GemTier] ?? TIER_SHADES.Garnet;
}

export function tierForScore(score: number): GemTier {
  let tier: GemTier = TIER_ORDER[0];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    if (score >= tierThresholds[i]) tier = TIER_ORDER[i];
  }
  return tier;
}

export function tierProgress(totalScore: number, gemTier: GemTier): { pct: number; nextTier: GemTier | null } {
  const idx = TIER_ORDER.indexOf(gemTier);
  if (idx === TIER_ORDER.length - 1) return { pct: 1, nextTier: null };
  const low  = tierThresholds[idx] ?? 0;
  const high = tierThresholds[idx + 1] ?? 1;
  return {
    pct: Math.min(1, (totalScore - low) / (high - low)),
    nextTier: TIER_ORDER[idx + 1] ?? null,
  };
}

export const RARITY_COLORS: Record<string, string> = {
  Common: '#4A5A6B',
  Rare:   '#D97F1F',
  Epic:   '#C1461E',
};

export const ITEM_NAME_KEYS: Record<string, string> = {
  frame_bronze_ring: 'item_frame_bronze', frame_ember_ring: 'item_frame_ember',
  frame_gold_crown: 'item_frame_crown', frame_iron_thorns: 'item_frame_thorns',
  title_wanderer: 'item_title_wanderer', title_icebreaker: 'item_title_icebreaker',
  title_flamekeeper: 'item_title_flamekeeper', title_dragonheart: 'item_title_dragonheart',
  title_threadweaver: 'item_title_threadweaver', title_fateseer: 'item_title_fateseer',
  title_bondkeeper: 'item_title_bondkeeper', title_oathkeeper: 'item_title_oathkeeper',
  emblem_torch: 'item_emblem_torch', emblem_worn_map: 'item_emblem_map',
  emblem_lucky_dice: 'item_emblem_dice', emblem_phoenix: 'item_emblem_phoenix',
};
export const FRAME_COLORS: Record<string, string> = {
  frame_bronze_ring: '#4A5A6B', frame_ember_ring: '#C1461E',
  frame_gold_crown: '#F5A83C', frame_iron_thorns: '#8F97A3',
};

export interface DroppedItem {
  nameKey: string;
  rarity: string;
}

export function toDroppedItem(item?: { nameKey?: string | null; rarity?: string | null } | null): DroppedItem | null {
  if (!item?.nameKey || !item?.rarity) return null;
  return { nameKey: item.nameKey, rarity: item.rarity };
}
