import type { GemTier } from '../models/user';
import { i18n } from './i18n';
import { COLORS, GEM_COLORS, GEM_SHADES } from './theme';

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

export const TIER_COLORS: Record<GemTier, string> = GEM_COLORS;

export const TIER_SHADES: Record<GemTier, string> = GEM_SHADES;

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
  Common: COLORS.bronze,
  Rare:   COLORS.gold,
  Epic:   COLORS.ember,
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
const TIER_NAME_KEYS: Record<GemTier, string> = {
  Garnet: 'gem_garnet', Opal: 'gem_opal', Amethyst: 'gem_amethyst',
  Sapphire: 'gem_sapphire', Ruby: 'gem_ruby', Emerald: 'gem_emerald',
};
const MEMBERSHIP_NAME_KEYS: Record<string, string> = {
  Free: 'rank_free', Silver: 'rank_silver', Gold: 'rank_gold',
};

/**
 * Gem tiers and guild ranks arrive from the engine as English identifiers. Falling back to the
 * raw identifier rather than `i18n.t('')` matters: an unmapped key would otherwise render as
 * i18n-js's literal `[missing "mn." translation]` marker in the UI.
 */
export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return '';
  const key = TIER_NAME_KEYS[tier as GemTier];
  return key ? i18n.t(key) : tier;
}

export function membershipLabel(level: string | null | undefined): string {
  if (!level) return '';
  const key = MEMBERSHIP_NAME_KEYS[level];
  return key ? i18n.t(key) : level;
}

/** Same guard for loot item names, which are keyed by an engine-side catalogue id. */
export function itemLabel(itemId: string | null | undefined): string {
  if (!itemId) return '';
  const key = ITEM_NAME_KEYS[itemId];
  return key ? i18n.t(key) : itemId;
}

export const FRAME_COLORS: Record<string, string> = {
  frame_bronze_ring: COLORS.bronze, frame_ember_ring: COLORS.ember,
  frame_gold_crown: COLORS.goldBright, frame_iron_thorns: COLORS.textDim,
};

export interface DroppedItem {
  nameKey: string;
  rarity: string;
}

export function toDroppedItem(item?: { nameKey?: string | null; rarity?: string | null } | null): DroppedItem | null {
  if (!item?.nameKey || !item?.rarity) return null;
  return { nameKey: item.nameKey, rarity: item.rarity };
}
