import { COLORS, overlay } from '../theme';

/**
 * Six light signatures, not free-form values per room. A room picks one the way a button picks a
 * metal from `BUTTON_METALS` — so the hold stays coherent as rooms are added, and nobody has to
 * invent a vignette strength on a Tuesday.
 *
 * Twice now this table has failed in the same direction. First the warm rooms washed gold or ember
 * over the *whole screen*, which read as a coloured film over the UI rather than as firelight.
 * The fix was to strip every signature back to a `silver` wash at 0.00–0.06 alpha — after which
 * all six signatures were separated by nothing but two opacity numbers a couple of points apart,
 * and the Gate and the Tavern were, in practice, the same room. A lighting system was built and
 * then switched off to work around a texture bug.
 *
 * What was actually wrong both times was *where* the colour was painted, never that it was there:
 *
 * - `tone` is the room's own light, and it is drawn on the **floor layer, behind the navigator**,
 *   as a gradient rising from the bottom edge. Behind everything means it cannot wash over body
 *   copy no matter how strong it gets, which is exactly what the full-screen wash could not
 *   promise. So the Tavern gets its fire back and the Forge gets its heat.
 * - `edge` tints the vignette, which only ever touches the top and bottom margins.
 *
 * Every alpha still starts at 0, so an unlit room has no film on it at all — that rule survived
 * both regressions and is the one worth keeping.
 */
export type LightSignature = 'cold' | 'neutral' | 'warm' | 'soft' | 'dark' | 'hot';

export interface LightRecipe {
  /** Ground opacity at no light … at full light. The floor gets *more* legible when lit. */
  readonly floor: readonly [number, number];
  /** Vignette opacity at no light … at full light. Runs downward: light opens the edges up. */
  readonly vignette: readonly [number, number];
  /** The colour the vignette closes this room in with — night has a temperature too. */
  readonly edge: string;
  /** The colour of the room's own light, rising from the floor. */
  readonly tone: string;
  /** Its alpha at no light … at full light. Safe to be strong: this layer sits behind the UI. */
  readonly toneAlpha: readonly [number, number];
}

/** Night, at four temperatures. Alpha is carried here rather than by the layer so a room can be
 *  closed in harder as well as colder — the Deep is both. */
const NIGHT = {
  blue:  'rgba(8,12,24,0.90)',
  plain: overlay(0.9),
  brown: 'rgba(20,11,6,0.90)',
  black: 'rgba(4,4,9,0.94)',
} as const;

export const LIGHT: Record<LightSignature, LightRecipe> = {
  // Stone with no fire in it. The Gate and the Hall — places that record rather than warm.
  cold:    { floor: [0.10, 0.16], vignette: [0.55, 0.40], edge: NIGHT.blue,  tone: COLORS.silver, toneAlpha: [0.00, 0.07] },
  // The default room. Open, unremarkable, no opinion.
  neutral: { floor: [0.12, 0.18], vignette: [0.50, 0.32], edge: NIGHT.plain, tone: COLORS.silver, toneAlpha: [0.00, 0.09] },
  // Fire and people. The Tavern — the most open room in the hold, so the dark closes in least.
  warm:    { floor: [0.14, 0.20], vignette: [0.45, 0.26], edge: NIGHT.brown, tone: COLORS.gold,   toneAlpha: [0.00, 0.22] },
  // A banked fire — quieter than warm, still inhabited. The Hearth.
  soft:    { floor: [0.12, 0.17], vignette: [0.50, 0.34], edge: NIGHT.brown, tone: COLORS.brass,  toneAlpha: [0.00, 0.14] },
  // Underground. Starts nearly black and is lit only by what the pair has cleared.
  dark:    { floor: [0.16, 0.22], vignette: [0.72, 0.42], edge: NIGHT.black, tone: COLORS.ember,  toneAlpha: [0.00, 0.11] },
  // Worked metal. The Forge keeps a lifted floor even when idle, and burns hottest when full.
  hot:     { floor: [0.14, 0.19], vignette: [0.48, 0.30], edge: NIGHT.brown, tone: COLORS.ember,  toneAlpha: [0.00, 0.26] },
};

/** The neutral vignette colour. Rooms carry their own in `edge`; this is the fallback. */
export const VIGNETTE_EDGE = NIGHT.plain;

/**
 * Time of day, read off the device clock. The hold has windows: a room at dawn is a little colder
 * and bluer than the same room at noon, and at night the dark closes in harder. Four phases in
 * local hours, so a user's evening is the hold's evening.
 */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export function dayPhase(d: Date): DayPhase {
  const h = d.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/** Added to a room's light before it is animated. Small on purpose: weather, not a room change. */
export const PHASE_OFFSET: Record<DayPhase, number> = {
  dawn: -0.10,
  day: 0,
  dusk: 0.08,
  night: -0.15,
};

/**
 * What colour the vignette closes in with at each phase. Null means the room's own `edge` — by
 * day the room keeps its temperature; at other hours the sky has one of its own.
 */
export const PHASE_EDGE: Record<DayPhase, string | null> = {
  dawn: NIGHT.blue,
  day: null,
  dusk: NIGHT.brown,
  night: NIGHT.black,
};

/** Null stays null: the time of day never turns "not loaded yet" into a number. */
export function applyPhase(light: number | null, phase: DayPhase): number | null {
  return light == null ? null : clamp01(light + PHASE_OFFSET[phase]);
}

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
  /**
   * The open conversation, when a delve is open. `lastMessageAt` is null for a thread with no
   * messages yet; the whole field is null when the cache has not heard of the thread. Optional
   * because readers that only count (the atlas) carry no clock and no thread.
   */
  conversation?: { lastMessageAt: string | null } | null;
  /** The clock every time-based ramp reads, so the functions stay pure. Ticks once a minute. */
  now?: number;
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

/** Torches alone: a room per cleared campaign room. Null until the map has loaded. */
const torchLight = (s: WorldState): number | null =>
  s.delve && s.delve.total > 0 ? clamp01(s.delve.cleared / s.delve.total) : null;

/**
 * The Deep is lit by whichever burns brighter: the hearth of the conversation itself, or the
 * torches the pair has planted through the campaign. A thread that has gone quiet cools on its
 * own (see `conversationWarmth`); a cleared delve keeps its torches lit regardless.
 */
export const delveLight: LightFn = (s) => {
  const torches = torchLight(s);
  if (s.conversation == null || s.now == null) return torches;
  const warmth = conversationWarmth(s.conversation.lastMessageAt, s.now);
  if (warmth == null) return torches;
  return Math.max(warmth, torches ?? 0);
};

/** Fully warm for this long after the last message. */
export const WARMTH_FULL_MS = 60 * 60 * 1000;
/** Cold by here — the ghosting window, after which the engine calls the thread abandoned. */
export const WARMTH_COLD_MS = 48 * 60 * 60 * 1000;
/** A hearth never goes out entirely while the thread is open; it banks to this. */
export const WARMTH_FLOOR = 0.1;

/**
 * How warm a conversation is, from the age of its newest message: 1 within the hour, cooling in a
 * straight line to `WARMTH_FLOOR` at the ghosting window and banked there beyond it. A thread with
 * no message yet is unknown (null), not cold — the layer holds rather than darkens.
 */
export function conversationWarmth(lastMessageAt: string | null, now: number): number | null {
  if (lastMessageAt == null) return null;
  const at = Date.parse(lastMessageAt);
  if (Number.isNaN(at)) return null;
  const age = now - at;
  if (age <= WARMTH_FULL_MS) return 1;
  if (age >= WARMTH_COLD_MS) return WARMTH_FLOOR;
  const t = (age - WARMTH_FULL_MS) / (WARMTH_COLD_MS - WARMTH_FULL_MS);
  return clamp01(1 - (1 - WARMTH_FLOOR) * t);
}

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
