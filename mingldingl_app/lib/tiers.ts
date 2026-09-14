import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { GemTier } from '../models/user';
import { tKey } from './i18n';
import { GEM_COLORS, GEM_SHADES, METAL, TIER_PRESENCE } from './theme';
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

/** A read of the live ladder, for a caller that draws every rung rather than one gap (`AscentSky`).
 *  Never re-derive thresholds elsewhere — this is the one door onto the private array. */
export function tierThresholdsSnapshot(): readonly number[] {
  return tierThresholds;
}

export function colorForTier(tier: string): string {
  return GEM_COLORS[tier as GemTier] ?? GEM_COLORS.Garnet;
}

export function shadeForTier(tier: string): string {
  return GEM_SHADES[tier as GemTier] ?? GEM_SHADES.Garnet;
}

/**
 * How rank is drawn, now that the jewels are luminance-matched and hue can no longer carry it.
 * `TIER_PRESENCE` holds the ramp; this turns one row of it into the three numbers a badge needs,
 * clamped for the size it is actually being drawn at.
 *
 * Kept a pure function rather than inlined into `GemTierBadge` so the ladder can be asserted
 * without rendering: the bug this replaces (a hard `tierIndex >= 3` cliff, so tiers 1-3 were
 * identical and tiers 4-6 were identical) was invisible to every test the badge had.
 */
export interface TierPresence {
  /** Bezel weight. Rank you can see at a glance without any animation running. */
  readonly ringWidth: number;
  /** 0..1, normalised against the top of the ladder so Emerald keeps the glow it has today. */
  readonly glowStrength: number;
  /** 0..1 sweep-highlight strength. 0 means the badge does not shimmer at all. */
  readonly shimmer: number;
}

/** Under this a heavy ring is not a rank, it is a filled diamond — the 16px HUD badges live here. */
const RING_MIN_SIZE = 28;
/** A sweep needs room to travel; below this it reads as a flicker rather than a shine. */
const SHIMMER_MIN_SIZE = 32;

const MAX_GLOW = Math.max(...TIER_ORDER.map((t) => TIER_PRESENCE[t].glow));

export function presenceForTier(tier: string, size: number): TierPresence {
  const row = TIER_PRESENCE[tier as GemTier] ?? TIER_PRESENCE[TIER_ORDER[0]];
  // Normalising against the table's own top keeps the ceiling fixed at what shipped before this
  // ramp existed, so wiring the ladder up brightens nothing — it only dims what outranks nothing.
  const strength = MAX_GLOW > 0 ? row.glow / MAX_GLOW : 0;
  return {
    ringWidth: size >= RING_MIN_SIZE ? row.ring : 1,
    glowStrength: strength,
    shimmer: size >= SHIMMER_MIN_SIZE ? strength : 0,
  };
}

export function tierForScore(score: number): GemTier {
  let tier: GemTier = TIER_ORDER[0];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    if (score >= tierThresholds[i]) tier = TIER_ORDER[i];
  }
  return tier;
}

// The engine's `rarity` field now carries an Ulzii metal: ember for the honours with stakes
// (Oath, Rite, boss), gold for everything else. Two metals, no fourth.
export const METAL_COLORS: Record<string, string> = {
  Gold:  METAL.gold,
  Ember: METAL.ember,
};

/** The metal a dropped or held honour is drawn in; an unknown rarity is gold, never uncoloured. */
export function metalForRarity(rarity: string | null | undefined): string {
  return METAL_COLORS[rarity ?? ''] ?? METAL.gold;
}

// Mirrors HonourService.Honours on the engine, in catalogue order; the id is data, the key is copy.
// The hall shows every honour whether or not it is held, so the app has to know the whole list.
export const HONOUR_IDS = [
  'title_oathkeeper', 'title_flamekeeper', 'title_sealbreaker',
  'title_threadweaver', 'title_fateseer', 'title_bondkeeper',
  'title_allycaller', 'title_trueword', 'title_sevendawns',
] as const;
export type HonourId = (typeof HONOUR_IDS)[number];

const ITEM_NAME_KEYS: Record<string, string> = {
  title_oathkeeper: 'item_title_oathkeeper', title_flamekeeper: 'item_title_flamekeeper',
  title_sealbreaker: 'item_title_sealbreaker', title_threadweaver: 'item_title_threadweaver',
  title_fateseer: 'item_title_fateseer', title_bondkeeper: 'item_title_bondkeeper',
  title_allycaller: 'item_title_allycaller', title_trueword: 'item_title_trueword',
  title_sevendawns: 'item_title_sevendawns',
};

/** The deed that grants each honour, shown on the dark slot so the hall doubles as a list of things to do. */
export const HONOUR_DEED_KEYS: Record<HonourId, string> = {
  title_oathkeeper: 'honour_deed_oathkeeper', title_flamekeeper: 'honour_deed_flamekeeper',
  title_sealbreaker: 'honour_deed_sealbreaker', title_threadweaver: 'honour_deed_threadweaver',
  title_fateseer: 'honour_deed_fateseer', title_bondkeeper: 'honour_deed_bondkeeper',
  title_allycaller: 'honour_deed_allycaller', title_trueword: 'honour_deed_trueword',
  title_sevendawns: 'honour_deed_sevendawns',
};

/** One sentence of story per honour, read from the slot's long-press sheet. */
export const HONOUR_LORE_KEYS: Record<HonourId, string> = {
  title_oathkeeper: 'honour_lore_oathkeeper', title_flamekeeper: 'honour_lore_flamekeeper',
  title_sealbreaker: 'honour_lore_sealbreaker', title_threadweaver: 'honour_lore_threadweaver',
  title_fateseer: 'honour_lore_fateseer', title_bondkeeper: 'honour_lore_bondkeeper',
  title_allycaller: 'honour_lore_allycaller', title_trueword: 'honour_lore_trueword',
  title_sevendawns: 'honour_lore_sevendawns',
};

export type HonourIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The emblem struck on each honour. The three thread honours share one family that grows a
 * vertex per rung, so the triptych reads as one story told three times rather than three
 * unrelated badges.
 */
export const HONOUR_ICONS: Record<HonourId, HonourIconName> = {
  title_oathkeeper: 'hand-heart',
  title_flamekeeper: 'fire',
  title_sealbreaker: 'seal',
  title_threadweaver: 'vector-line',
  title_fateseer: 'vector-polyline',
  title_bondkeeper: 'vector-triangle',
  title_allycaller: 'bugle',
  title_trueword: 'handshake',
  title_sevendawns: 'weather-sunset-up',
};

/** The thread honours in rung order — the hall chains these three into one row. */
export const THREAD_HONOUR_IDS = ['title_threadweaver', 'title_fateseer', 'title_bondkeeper'] as const satisfies readonly HonourId[];

/** Sparked threads each rung asks for; mirrors the engine's ship-honour ladder. */
export const THREAD_HONOUR_NEEDED: Record<(typeof THREAD_HONOUR_IDS)[number], number> = {
  title_threadweaver: 1, title_fateseer: 5, title_bondkeeper: 10,
};

/** Consecutive dawns Seven Dawns asks for. */
export const SEVEN_DAWNS_NEEDED = 7;
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

/** Same guard for honour names, which are keyed by an engine-side catalogue id. */
export function itemLabel(itemId: string | null | undefined): string {
  if (!itemId) return '';
  return tKey(ITEM_NAME_KEYS[itemId], itemId);
}

export interface DroppedItem {
  nameKey: string;
  rarity: string;
}

export function toDroppedItem(item?: { nameKey?: string | null; rarity?: string | null } | null): DroppedItem | null {
  if (!item?.nameKey || !item?.rarity) return null;
  return { nameKey: item.nameKey, rarity: item.rarity };
}
