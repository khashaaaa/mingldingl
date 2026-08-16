import type { GemTier } from '../models/user';

export const TIER_ORDER: GemTier[] = ['Garnet', 'Opal', 'Amethyst', 'Sapphire', 'Ruby', 'Emerald'];

// Fallback only, for the brief window before useTierThresholds()'s fetch of
// GET /scores/tiers resolves (or if it fails). ScoreService.TierTable in the
// engine is the actual single source of truth now — these used to be a
// separately hand-maintained copy that drifted once already (this used to be
// [0, 100, 250, 500, 1000, 2500], disagreeing with the server on the
// Amethyst/Sapphire/Emerald boundaries: the client could show a tier-up toast
// early, then have it silently revert on the next profile refetch).
const DEFAULT_TIER_THRESHOLDS = [0, 100, 300, 600, 1000, 2000];
let tierThresholds: number[] = DEFAULT_TIER_THRESHOLDS;

// Called once by useTierThresholds() when GET /scores/tiers resolves.
// Validates shape before adopting it — a malformed/partial response leaves
// the existing (default or previously-hydrated) thresholds untouched rather
// than corrupting tier math for the rest of the session.
export function hydrateTierThresholds(raw: readonly { tier?: string | null; minScore?: number }[]): void {
  const byTier = new Map(raw.map((t) => [t.tier, t.minScore]));
  const ordered = TIER_ORDER.map((tier) => byTier.get(tier));
  if (ordered.some((v) => typeof v !== 'number')) return;
  tierThresholds = ordered as number[];
}

// Sharp, saturated colors that read as the actual named gemstone rather than
// a pastel swatch (e.g. Opal is fire-opal teal, not washed-out pale cyan;
// Sapphire sits near the real "sapphire blue" #0F52BA family). TIER_SHADES is
// the deep/pavilion-in-shadow counterpart used for GemTierBadge's gradient —
// TIER_COLORS stays the single "true" color used for text/border tints.
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

// Both read the same module-level tierThresholds (default until
// hydrateTierThresholds resolves) so they can never disagree with each other
// the way this used to disagree with the server.
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
  Common: '#4A5A6B',   // COLORS.bronze
  Rare:   '#D97F1F',   // COLORS.gold
  Epic:   '#C1461E',   // COLORS.ember
};

export const ITEM_NAME_KEYS: Record<string, string> = {
  frame_bronze_ring: 'item_frame_bronze', frame_ember_ring: 'item_frame_ember',
  frame_gold_crown: 'item_frame_crown', frame_iron_thorns: 'item_frame_thorns',
  title_wanderer: 'item_title_wanderer', title_icebreaker: 'item_title_icebreaker',
  title_flamekeeper: 'item_title_flamekeeper', title_dragonheart: 'item_title_dragonheart',
  title_threadweaver: 'item_title_threadweaver', title_fateseer: 'item_title_fateseer',
  title_bondkeeper: 'item_title_bondkeeper',
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

/** Narrows an optional API DroppedItem (nullable string fields) down to the
 * shape LootToast/ChestModal expect, or null if the drop is absent/incomplete. */
export function toDroppedItem(item?: { nameKey?: string | null; rarity?: string | null } | null): DroppedItem | null {
  if (!item?.nameKey || !item?.rarity) return null;
  return { nameKey: item.nameKey, rarity: item.rarity };
}
