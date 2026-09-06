import { COLORS, overlay } from '../theme';

/**
 * Six light signatures, not free-form values per room. A room picks one the way a button picks a
 * metal from `BUTTON_METALS` — so the hold stays coherent as rooms are added, and nobody has to
 * invent a vignette strength on a Tuesday.
 *
 * Every signature washes `silver`. The warm rooms used to wash gold or ember, which worked while
 * a brick texture broke the wash up; on the flat ground that replaced it, a coloured wash covering
 * the whole screen stopped reading as firelight and started reading as a red or amber film over
 * the UI. What tells rooms apart now is `vignette` — how far the dark closes in — and `floor`, how
 * far the ground lifts out of `COLORS.bg`. The wash is left carrying brightness alone, and every
 * alpha starts at 0 so an unlit room has no film on it at all.
 */
export type LightSignature = 'cold' | 'neutral' | 'warm' | 'soft' | 'dark' | 'hot';

export interface LightRecipe {
  /** Wall texture opacity at no light … at full light. The floor gets *more* legible when lit. */
  readonly floor: readonly [number, number];
  /** Vignette opacity at no light … at full light. Runs downward: light opens the edges up. */
  readonly vignette: readonly [number, number];
  /** The colour the canopy washes the room in, and its alpha at no light … at full light.
   *  Uniformly `silver` today; the field stays per-room so one room can be tinted again
   *  without every other room inheriting it. */
  readonly wash: string;
  readonly washAlpha: readonly [number, number];
}

export const LIGHT: Record<LightSignature, LightRecipe> = {
  // Stone with no fire in it. The Gate and the Hall — places that record rather than warm.
  cold:    { floor: [0.10, 0.16], vignette: [0.55, 0.40], wash: COLORS.silver, washAlpha: [0.00, 0.05] },
  // The default room. Open, unremarkable, no opinion.
  neutral: { floor: [0.12, 0.18], vignette: [0.50, 0.32], wash: COLORS.silver, washAlpha: [0.00, 0.05] },
  // Fire and people. The Tavern — the most open room in the hold, so the dark closes in least.
  warm:    { floor: [0.14, 0.20], vignette: [0.45, 0.26], wash: COLORS.silver, washAlpha: [0.00, 0.05] },
  // A banked fire — quieter than warm, still inhabited. The Hearth.
  soft:    { floor: [0.12, 0.17], vignette: [0.50, 0.34], wash: COLORS.silver, washAlpha: [0.00, 0.04] },
  // Underground. Starts nearly black and is lit only by what the pair has cleared.
  dark:    { floor: [0.16, 0.22], vignette: [0.72, 0.42], wash: COLORS.silver, washAlpha: [0.00, 0.06] },
  // Worked metal. The Forge keeps a lifted floor even when idle.
  hot:     { floor: [0.14, 0.19], vignette: [0.48, 0.30], wash: COLORS.silver, washAlpha: [0.00, 0.05] },
};

/** The colour the vignette closes a room in with. Pure night-sky, so it reads as absence of light
 * rather than as a grey film over the UI. */
export const VIGNETTE_EDGE = overlay(0.9);

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function lerp(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * clamp01(t);
}

/**
 * Everything the light rule is allowed to read. Each field is nullable, and null means "not known
 * yet" rather than "zero" — the difference between a room that is dark and a room that has not
 * heard back from the server. Light functions return null for the latter and the layer holds.
 */
export interface WorldState {
  /** Daily match budget: how much of today's allowance is unspent. */
  budget: { remaining: number; budget: number } | null;
  /** Live matches. The Hearth lights a lamp per match, to a crowd of three. */
  activeMatches: number | null;
  tavern: { hasSession: boolean; isRsvpd: boolean } | null;
  /** The delve you are actually in — campaign rooms cleared out of the map's total. */
  delve: { cleared: number; total: number } | null;
  /** Profile completeness, 0..1. */
  profile: number | null;
  /** Honours earned, counted against `HONOUR_TOTAL`. */
  honours: number | null;
}

/** Nine named honours (`HonourService`). Kept here so the Hall's ladder has a top. */
export const HONOUR_TOTAL = 9;

/** A crowded hearth. Three live matches lights it fully; more does not light it further. */
export const HEARTH_FULL = 3;

export type LightFn = (s: WorldState) => number | null;

export const always: LightFn = () => 1;

export const roadLight: LightFn = (s) =>
  s.budget && s.budget.budget > 0 ? clamp01(s.budget.remaining / s.budget.budget) : null;

export const hearthLight: LightFn = (s) =>
  s.activeMatches == null ? null : clamp01(s.activeMatches / HEARTH_FULL);

export const tavernLight: LightFn = (s) =>
  s.tavern == null ? null : s.tavern.isRsvpd ? 1 : s.tavern.hasSession ? 0.6 : 0.15;

export const delveLight: LightFn = (s) =>
  s.delve && s.delve.total > 0 ? clamp01(s.delve.cleared / s.delve.total) : null;

export const forgeLight: LightFn = (s) => s.profile;

export const hallLight: LightFn = (s) =>
  s.honours == null ? null : clamp01(s.honours / HONOUR_TOTAL);

/**
 * Completeness the Forge reads. Photos carry half of it because they are the half of a profile a
 * candidate actually sees; the five deep fields share the rest with the bio.
 */
export function profileCompleteness(p: {
  photoUrls?: string[];
  bio?: string;
  hasKids?: boolean | null;
  smokingHabit?: string | null;
  drinkingHabit?: string | null;
  religion?: string | null;
  lifestyle?: string | null;
} | undefined | null): number | null {
  if (!p) return null;
  const photos = Math.min(p.photoUrls?.length ?? 0, 3) / 3;
  const bio = (p.bio?.trim().length ?? 0) > 0 ? 1 : 0;
  const deep = [p.hasKids, p.smokingHabit, p.drinkingHabit, p.religion, p.lifestyle]
    .filter((v) => v !== null && v !== undefined && v !== '').length / 5;
  return clamp01(photos * 0.5 + bio * 0.2 + deep * 0.3);
}
