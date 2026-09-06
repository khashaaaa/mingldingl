import type { GemTier } from '../models/user';
import { tKey } from './i18n';
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

// The engine's `rarity` field now carries an Ulzii metal: ember for the honours with stakes
// (Oath, Rite, boss), gold for everything else. Two metals, no fourth.
export const METAL_COLORS: Record<string, string> = {
  Gold:  COLORS.gold,
  Ember: COLORS.ember,
};

// Mirrors HonourService.Honours + TierFrames on the engine; the id is data, the key is copy.
export const ITEM_NAME_KEYS: Record<string, string> = {
  title_oathkeeper: 'item_title_oathkeeper', title_flamekeeper: 'item_title_flamekeeper',
  title_sealbreaker: 'item_title_sealbreaker', title_threadweaver: 'item_title_threadweaver',
  title_fateseer: 'item_title_fateseer', title_bondkeeper: 'item_title_bondkeeper',
  title_allycaller: 'item_title_allycaller', title_trueword: 'item_title_trueword',
  title_sevendawns: 'item_title_sevendawns',
  frame_garnet: 'item_frame_garnet', frame_opal: 'item_frame_opal', frame_amethyst: 'item_frame_amethyst',
  frame_sapphire: 'item_frame_sapphire', frame_ruby: 'item_frame_ruby', frame_emerald: 'item_frame_emerald',
};
const TIER_NAME_KEYS: Record<GemTier, string> = {
  Garnet: 'gem_garnet', Opal: 'gem_opal', Amethyst: 'gem_amethyst',
  Sapphire: 'gem_sapphire', Ruby: 'gem_ruby', Emerald: 'gem_emerald',
};
const MEMBERSHIP_NAME_KEYS: Record<string, string> = {
  Free: 'rank_free', Silver: 'rank_silver', Gold: 'rank_gold',
};

/**
 * Gem tiers and guild ranks arrive from the engine as English identifiers, so the key is data and
 * goes through `tKey`: an identifier this map has not caught up with falls back to the raw value
 * instead of rendering i18n-js's literal `[missing "mn." translation]` marker.
 */
export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return '';
  return tKey(TIER_NAME_KEYS[tier as GemTier], tier);
}

export function membershipLabel(level: string | null | undefined): string {
  if (!level) return '';
  return tKey(MEMBERSHIP_NAME_KEYS[level], level);
}

/** Same guard for honour and frame names, which are keyed by an engine-side catalogue id. */
export function itemLabel(itemId: string | null | undefined): string {
  if (!itemId) return '';
  return tKey(ITEM_NAME_KEYS[itemId], itemId);
}

/** Frames come with a gem tier and wear that tier's colour; `frame_<tier>` is the engine's id shape. */
export function frameIdForTier(tier: GemTier): string {
  return `frame_${tier.toLowerCase()}`;
}

export function tierForFrame(frameId: string | null | undefined): GemTier | null {
  if (!frameId) return null;
  return TIER_ORDER.find((tier) => frameIdForTier(tier) === frameId) ?? null;
}

export function frameColorFor(frameId: string | null | undefined): string | null {
  const tier = tierForFrame(frameId);
  return tier ? GEM_COLORS[tier] : null;
}

export interface DroppedItem {
  nameKey: string;
  rarity: string;
}

export function toDroppedItem(item?: { nameKey?: string | null; rarity?: string | null } | null): DroppedItem | null {
  if (!item?.nameKey || !item?.rarity) return null;
  return { nameKey: item.nameKey, rarity: item.rarity };
}
