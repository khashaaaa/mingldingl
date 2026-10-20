export type Fire = 'Lit' | 'Roaring' | 'Out';

/**
 * The seven rooms of the hold. Depth orders them for room travel: going deeper plays the door,
 * coming home rises. Stage 2 lights every room the same (Figma S1: Fire=Lit); Roaring and Out
 * arrive with the Hearth, the Flame Rite and the Frozen Gate.
 */
export const ROOMS = {
  gate: { depth: 0, fire: 'Lit' },
  road: { depth: 1, fire: 'Lit' },
  hearth: { depth: 2, fire: 'Lit' },
  tavern: { depth: 3, fire: 'Lit' },
  forge: { depth: 3, fire: 'Lit' },
  hall: { depth: 4, fire: 'Lit' },
  deep: { depth: 5, fire: 'Lit' },
} as const satisfies Record<string, { depth: number; fire: Fire }>;

export type Room = keyof typeof ROOMS;

/** Route segments (expo-router's useSegments) → the room it stands in. */
export function roomFor(segments: readonly string[]): Room {
  const [group, a, b] = segments;
  switch (group) {
    case '(out)':
    case '(closed)':
    case '(onboarding)':
      return 'gate';
    case '(world)':
      if (a === 'character-edit' || a === 'ascent' || a === 'deeds') return 'forge';
      if (a === 'war-room' || a === 'away' || a === 'sigil' || a === 'sigil-verify' || a === 'departing')
        return 'forge';
      if (a === 'codex') return 'hall';
      if (a === 'bond' || a === 'ceremony' || a === 'report') return 'tavern';
      if (a === 'frozen-gate') return 'deep';
      if (a === '(tabs)') {
        if (b === 'character' || b === undefined) return 'forge';
        if (b === 'seek' || b === 'quests') return 'tavern';
      }
      return 'hearth';
    default:
      return 'gate';
  }
}

let override: Fire | null = null;
const subs = new Set<() => void>();

/**
 * A screen whose fire differs from its room's (a bond gone cold, the Frozen Gate) sets it while
 * mounted. Returns the reset.
 */
export function setFireOverride(fire: Fire | null): () => void {
  override = fire;
  for (const s of subs) s();
  return () => {
    if (override === fire) {
      override = null;
      for (const s of subs) s();
    }
  };
}

export function subscribeFire(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export const getFireOverride = () => override;

/** The festival skies Figma paints (World Floor's Season variants). */
export type Sky = 'tsagaanSar' | 'naadam' | 'lastBell' | 'dayOfBond' | 'march8' | 'masked';

let sky: Sky | null = null;
const skySubs = new Set<() => void>();

/** A screen that dresses the sky itself (the masked round) sets it while mounted. Returns the reset. */
export function setSkyOverride(next: Sky | null): () => void {
  sky = next;
  for (const s of skySubs) s();
  return () => {
    if (sky === next) {
      sky = null;
      for (const s of skySubs) s();
    }
  };
}

export function subscribeSky(cb: () => void) {
  skySubs.add(cb);
  return () => {
    skySubs.delete(cb);
  };
}

export const getSkyOverride = () => sky;

let snow: boolean | null = null;
const snowSubs = new Set<() => void>();

/** The Tools screen's snow switch: null follows the engine's calendar. */
export function setSnowOverride(next: boolean | null) {
  snow = next;
  for (const s of snowSubs) s();
}

export function subscribeSnow(cb: () => void) {
  snowSubs.add(cb);
  return () => {
    snowSubs.delete(cb);
  };
}

export const getSnowOverride = () => snow;
