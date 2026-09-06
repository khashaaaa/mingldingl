import type { Href } from 'expo-router';
import {
  always, delveLight, forgeLight, hallLight, hearthLight, roadLight, tavernLight,
  type LightFn, type LightSignature,
} from './light';

/**
 * The hold. One row per room, and the row is the whole truth about that place: where it sits on
 * the atlas, how it is lit, what drifts through it, how deep it is, and which routes are in it.
 *
 * The atlas draws itself from this table and so does the lighting, which is the point — a map and
 * a light that read the same fact cannot disagree. Adding a room is one entry; adding a *screen*
 * to an existing room is one string.
 */
export type RoomName = 'gate' | 'road' | 'tavern' | 'hearth' | 'deep' | 'forge' | 'hall';

export type RoomVfx = 'ember' | 'fog' | null;

/**
 * What the floor is made of. The Tavern was already floored in parchment rather than dungeon
 * stone before this table existed — the notice board is paper, not rock — so the distinction
 * moves into the row instead of being lost to a uniform wall.
 */
export type RoomTexture = 'wall' | 'parchment';

export interface RoomDef {
  /** Route prefixes, as `useSegments()` joins them. Longest prefix wins. */
  readonly match: readonly string[];
  readonly base: LightSignature;
  readonly texture: RoomTexture;
  readonly vfx: RoomVfx;
  readonly light: LightFn;
  /** Atlas position on a 3-wide grid; y grows downward, into the hill. */
  readonly atlas: { readonly x: number; readonly y: number };
  /** 0 outside, 1 in the hold proper, 2 underground. Drives the travel direction. */
  readonly depth: 0 | 1 | 2;
  readonly key: string;
  /** Where the atlas sends you. The Deep has none — it is N delves, so it routes to the Hearth. */
  readonly route: Href;
}

export const ROOMS: Record<RoomName, RoomDef> = {
  gate: {
    match: ['(auth)', '(onboarding)'],
    base: 'cold', texture: 'wall', vfx: 'fog', light: always,
    atlas: { x: 1, y: 0 }, depth: 0, key: 'room_gate', route: '/(tabs)/discover',
  },
  road: {
    match: ['(tabs)/discover'],
    base: 'neutral', texture: 'wall', vfx: 'ember', light: roadLight,
    atlas: { x: 2, y: 1 }, depth: 1, key: 'room_road', route: '/(tabs)/discover',
  },
  tavern: {
    match: ['(tabs)/townsquare', 'townsquare-round', '(tabs)/activity', 'business'],
    base: 'warm', texture: 'parchment', vfx: 'ember', light: tavernLight,
    atlas: { x: 0, y: 1 }, depth: 1, key: 'room_tavern', route: '/(tabs)/townsquare',
  },
  hearth: {
    match: ['(tabs)/matches', 'ship'],
    base: 'soft', texture: 'wall', vfx: null, light: hearthLight,
    atlas: { x: 1, y: 2 }, depth: 1, key: 'room_hearth', route: '/(tabs)/matches',
  },
  forge: {
    match: ['(tabs)/profile', 'edit-profile', 'membership', 'settings', 'blocked-users'],
    base: 'hot', texture: 'wall', vfx: 'ember', light: forgeLight,
    atlas: { x: 0, y: 3 }, depth: 1, key: 'room_forge', route: '/(tabs)/profile',
  },
  hall: {
    match: ['progression', 'leaderboard', 'date-log', 'guides', 'privacy', 'terms'],
    base: 'cold', texture: 'wall', vfx: null, light: hallLight,
    atlas: { x: 2, y: 3 }, depth: 1, key: 'room_hall', route: '/progression',
  },
  deep: {
    match: ['chat', 'campaign', 'icebreaker', 'quiz', 'activities'],
    base: 'dark', texture: 'wall', vfx: 'fog', light: delveLight,
    atlas: { x: 1, y: 4 }, depth: 2, key: 'room_deep', route: '/(tabs)/matches',
  },
};

/** Which rooms the atlas draws a passage between. Undirected; drawn once per pair. */
export const PASSAGES: ReadonlyArray<readonly [RoomName, RoomName]> = [
  ['gate', 'tavern'], ['gate', 'road'],
  ['tavern', 'hearth'], ['road', 'hearth'],
  ['hearth', 'forge'], ['hearth', 'hall'], ['hearth', 'deep'],
];

/**
 * Routes that refuse the world outright. Agora composites onto black, so any light we paint over
 * the call is a bug rather than a mood.
 */
export const UNLIT: readonly string[] = ['video'];

/** Where an unrecognised route lands. Dim but correct beats a crash on a screen nobody mapped. */
export const DEFAULT_ROOM: RoomName = 'hearth';

const ROOM_NAMES = Object.keys(ROOMS) as RoomName[];

export function pathOf(segments: readonly string[]): string {
  return segments.filter(Boolean).join('/');
}

export function isUnlit(path: string): boolean {
  return UNLIT.some((u) => path === u || path.startsWith(`${u}/`));
}

/**
 * Strict resolution: the room whose longest `match` prefix covers this path, or undefined when the
 * hold has no place for it. The route-coverage test calls this one — going through `roomFor`
 * instead would let `DEFAULT_ROOM` quietly absorb every screen nobody thought about.
 */
export function matchRoom(path: string): RoomName | undefined {
  let best: RoomName | undefined;
  let bestLen = -1;
  for (const name of ROOM_NAMES) {
    for (const prefix of ROOMS[name].match) {
      if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
      if (prefix.length > bestLen) {
        best = name;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

/** Runtime resolution: null means the route is deliberately unlit. */
export function roomFor(segments: readonly string[]): RoomName | null {
  const path = pathOf(segments);
  if (isUnlit(path)) return null;
  return matchRoom(path) ?? DEFAULT_ROOM;
}
