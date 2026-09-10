import fs from 'fs';
import path from 'path';
import {
  DEFAULT_ROOM, PASSAGES, ROOMS, isUnlit, matchRoom, pathOf, roomFor,
} from '../rooms';
import {
  HEARTH_FULL, HONOUR_TOTAL, LIGHT, PHASE_EDGE, PHASE_OFFSET, WARMTH_FLOOR, applyPhase, clamp01,
  conversationWarmth, dayPhase, delveLight, forgeLight, hallLight, hearthLight, lerp,
  profileCompleteness, roadLight, tavernLight, type WorldState,
} from '../light';

const NOW = Date.parse('2026-09-10T12:00:00Z');

const EMPTY: WorldState = {
  budget: null, activeMatches: null, tavern: null, delve: null, profile: null, honours: null,
  conversation: null, now: NOW,
};

const HOUR = 60 * 60 * 1000;

/** An ISO timestamp this many hours before `NOW`. */
function ago(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString();
}

describe('room resolution', () => {
  it.each([
    [['(auth)', 'phone'], 'gate'],
    [['(onboarding)', 'index'], 'gate'],
    [['(tabs)', 'discover'], 'road'],
    [['(tabs)', 'matches'], 'hearth'],
    [['(tabs)', 'townsquare'], 'tavern'],
    [['(tabs)', 'activity'], 'tavern'],
    [['(tabs)', 'profile'], 'forge'],
    [['chat', '[matchId]'], 'deep'],
    [['campaign', '[matchId]'], 'deep'],
    [['edit-profile'], 'forge'],
    [['progression'], 'hall'],
    [['ship', 'new'], 'hearth'],
  ] as const)('%s is in the %s', (segments, room) => {
    expect(roomFor(segments)).toBe(room);
  });

  it('leaves the video call unlit — Agora composites onto black', () => {
    expect(roomFor(['video', '[matchId]'])).toBeNull();
    expect(isUnlit('video/[matchId]')).toBe(true);
  });

  it('is not fooled by a route that merely starts with a room prefix', () => {
    expect(isUnlit('videography')).toBe(false);
    expect(matchRoom('shipyard')).toBeUndefined();
  });

  it('prefers the longest matching prefix', () => {
    // '(tabs)/profile' must beat a hypothetical bare '(tabs)' entry rather than tying with it.
    expect(matchRoom('(tabs)/profile')).toBe('forge');
    expect(matchRoom('(tabs)/profile/anything')).toBe('forge');
  });

  it('falls back to a real room for a route nobody mapped', () => {
    expect(matchRoom('some-new-screen')).toBeUndefined();
    expect(roomFor(['some-new-screen'])).toBe(DEFAULT_ROOM);
  });

  it('drops empty segments when joining', () => {
    expect(pathOf(['(tabs)', '', 'discover'])).toBe('(tabs)/discover');
  });
});

/**
 * The guard against the drift that produced the hand-copied `TiledBackdrop` this layer replaces:
 * a new screen either has a place in the hold or has said out loud that it does not.
 */
describe('route coverage', () => {
  const appDir = path.resolve(__dirname, '../../../app');

  function routes(dir: string, prefix: string[] = []): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      // `__tests__` lives beside the routes it covers but is not one.
      if (entry.name === '__tests__') return [];
      if (entry.isDirectory()) return routes(full, [...prefix, entry.name]);
      if (!/\.tsx$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) return [];
      const base = entry.name.replace(/\.tsx$/, '');
      if (base === '_layout') return [];
      return [pathOf([...prefix, base])];
    });
  }

  const all = routes(appDir);

  it('found the app routes', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it.each(all)('%s belongs to a room or is explicitly unlit', (route) => {
    expect(isUnlit(route) || matchRoom(route) !== undefined).toBe(true);
  });
});

describe('the atlas graph', () => {
  it('places every room at its own coordinate', () => {
    const seen = new Set(Object.values(ROOMS).map((r) => `${r.atlas.x},${r.atlas.y}`));
    expect(seen.size).toBe(Object.keys(ROOMS).length);
  });

  it('connects every room to the graph', () => {
    const connected = new Set(PASSAGES.flat());
    expect([...Object.keys(ROOMS)].every((r) => connected.has(r as never))).toBe(true);
  });

  it('puts the delve deeper than the hold and the gate above it', () => {
    expect(ROOMS.deep.depth).toBe(2);
    expect(ROOMS.gate.depth).toBe(0);
    expect(ROOMS.hearth.depth).toBe(1);
  });
});

describe('light ramps', () => {
  it('clamps out of range values', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(4)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
  });

  it('interpolates between the ends of a range', () => {
    expect(lerp([0, 1], 0.5)).toBe(0.5);
    expect(lerp([0.7, 0.4], 1)).toBeCloseTo(0.4);
  });

  it('opens the vignette as a room lights, in every signature', () => {
    for (const recipe of Object.values(LIGHT)) {
      expect(recipe.vignette[1]).toBeLessThan(recipe.vignette[0]);
      expect(recipe.floor[1]).toBeGreaterThan(recipe.floor[0]);
      expect(recipe.toneAlpha[1]).toBeGreaterThan(recipe.toneAlpha[0]);
    }
  });

  it('keeps the Deep the darkest room and the Tavern the most open', () => {
    expect(LIGHT.dark.vignette[0]).toBeGreaterThan(LIGHT.warm.vignette[0]);
    expect(LIGHT.warm.vignette[0]).toBeLessThan(LIGHT.cold.vignette[0]);
    expect(LIGHT.dark.floor[0]).toBeGreaterThan(LIGHT.cold.floor[0]);
  });

  /**
   * This replaces an assertion that every signature washed the *same* colour. That rule was
   * written to stop a full-screen coloured wash from filming over the UI, and it worked — by
   * collapsing all six signatures into one, so the Gate and the Tavern rendered identically and
   * nothing caught it. Colour is safe again because it moved behind the navigator; what needs
   * guarding now is the collapse, not the colour.
   */
  it('renders no two signatures the same way', () => {
    const fingerprints = Object.values(LIGHT).map((r) => JSON.stringify([
      r.floor, r.vignette, r.edge, r.tone, r.toneAlpha,
    ]));
    expect(new Set(fingerprints).size).toBe(Object.keys(LIGHT).length);
  });

  it('gives the rooms with fire in them a different light from the rooms without', () => {
    expect(LIGHT.warm.tone).not.toBe(LIGHT.cold.tone);
    expect(LIGHT.hot.tone).not.toBe(LIGHT.cold.tone);
    // The Forge at full heat is the brightest floor in the hold; the Gate the coolest.
    expect(LIGHT.hot.toneAlpha[1]).toBeGreaterThan(LIGHT.cold.toneAlpha[1]);
  });

  it('leaves an unlit room with no light of its own', () => {
    for (const recipe of Object.values(LIGHT)) {
      expect(recipe.toneAlpha[0]).toBe(0);
    }
  });
});

describe('light functions', () => {
  it('return null on every room when nothing has loaded', () => {
    for (const fn of [roadLight, hearthLight, tavernLight, delveLight, forgeLight, hallLight]) {
      expect(fn(EMPTY)).toBeNull();
    }
  });

  it('lights the Road by unspent daily budget', () => {
    expect(roadLight({ ...EMPTY, budget: { budget: 10, remaining: 10 } })).toBe(1);
    expect(roadLight({ ...EMPTY, budget: { budget: 10, remaining: 0 } })).toBe(0);
  });

  it('does not divide by a zero budget', () => {
    expect(roadLight({ ...EMPTY, budget: { budget: 0, remaining: 0 } })).toBeNull();
  });

  it('lights a lamp per live match up to a crowd', () => {
    expect(hearthLight({ ...EMPTY, activeMatches: 0 })).toBe(0);
    expect(hearthLight({ ...EMPTY, activeMatches: HEARTH_FULL })).toBe(1);
    expect(hearthLight({ ...EMPTY, activeMatches: 40 })).toBe(1);
  });

  it('brightens the Tavern for a session and fully for an RSVP', () => {
    const dark = tavernLight({ ...EMPTY, tavern: { hasSession: false, isRsvpd: false } })!;
    const lit = tavernLight({ ...EMPTY, tavern: { hasSession: true, isRsvpd: false } })!;
    const going = tavernLight({ ...EMPTY, tavern: { hasSession: true, isRsvpd: true } })!;
    expect(dark).toBeLessThan(lit);
    expect(lit).toBeLessThan(going);
    expect(going).toBe(1);
  });

  it('lights the Deep a torch per cleared room', () => {
    expect(delveLight({ ...EMPTY, delve: { cleared: 0, total: 7 } })).toBe(0);
    expect(delveLight({ ...EMPTY, delve: { cleared: 7, total: 7 } })).toBe(1);
    expect(delveLight({ ...EMPTY, delve: { cleared: 3, total: 7 } })).toBeCloseTo(3 / 7);
  });

  it('holds rather than darkening when a delve has no rooms yet', () => {
    expect(delveLight({ ...EMPTY, delve: { cleared: 0, total: 0 } })).toBeNull();
  });

  it('lights the Deep by the warmer of the conversation and the torches', () => {
    const torches = { cleared: 1, total: 4 };
    // A fresh message outshines one torch in four.
    expect(delveLight({ ...EMPTY, delve: torches, conversation: { lastMessageAt: ago(0) } })).toBe(1);
    // A thread gone cold falls back to the torches the pair has planted.
    expect(delveLight({ ...EMPTY, delve: torches, conversation: { lastMessageAt: ago(100) } })).toBeCloseTo(0.25);
    // A cold thread with no campaign loaded is still lit by its banked hearth, not held.
    expect(delveLight({ ...EMPTY, conversation: { lastMessageAt: ago(100) } })).toBe(WARMTH_FLOOR);
  });

  it('holds the Deep when the thread is open but has no messages and no torches', () => {
    expect(delveLight({ ...EMPTY, conversation: { lastMessageAt: null } })).toBeNull();
    // ...and lights it by torches alone when it has those.
    expect(delveLight({ ...EMPTY, delve: { cleared: 2, total: 4 }, conversation: { lastMessageAt: null } })).toBe(0.5);
  });

  it('ignores the conversation when it has no clock to read it by', () => {
    expect(delveLight({ ...EMPTY, now: undefined, conversation: { lastMessageAt: ago(0) } })).toBeNull();
  });
});

describe('a hearth that cools', () => {
  it('is unknown without a message', () => {
    expect(conversationWarmth(null, NOW)).toBeNull();
    expect(conversationWarmth('not a date', NOW)).toBeNull();
  });

  it('is fully warm within the hour', () => {
    expect(conversationWarmth(ago(0), NOW)).toBe(1);
    expect(conversationWarmth(ago(1), NOW)).toBe(1);
  });

  it('cools in a straight line to the ghosting window', () => {
    const day = conversationWarmth(ago(24), NOW)!;
    // 23 of the 47 cooling hours have passed.
    expect(day).toBeCloseTo(1 - 0.9 * (23 / 47));
    expect(day).toBeLessThan(1);
    expect(day).toBeGreaterThan(WARMTH_FLOOR);
    expect(conversationWarmth(ago(48), NOW)).toBeCloseTo(WARMTH_FLOOR);
  });

  it('banks at the floor rather than going out', () => {
    expect(conversationWarmth(ago(100), NOW)).toBe(WARMTH_FLOOR);
  });

  it('never rises from a message in the future', () => {
    expect(conversationWarmth(ago(-5), NOW)).toBe(1);
  });
});

describe('time of day', () => {
  function at(hour: number, minute = 0): Date {
    const d = new Date(2026, 8, 10, hour, minute, 0, 0);
    return d;
  }

  it.each([
    [0, 'night'], [4, 'night'], [4, 59, 'night'],
    [5, 'dawn'], [7, 59, 'dawn'],
    [8, 'day'], [12, 'day'], [16, 59, 'day'],
    [17, 'dusk'], [19, 59, 'dusk'],
    [20, 'night'], [23, 'night'],
  ] as const)('%s:%s is %s', (...args) => {
    const phase = args[args.length - 1];
    const hour = args[0];
    const minute = args.length === 3 ? (args[1] as number) : 0;
    expect(dayPhase(at(hour, minute))).toBe(phase);
  });

  it('keeps null as null — no data is not darkness, whatever the hour', () => {
    for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
      expect(applyPhase(null, phase)).toBeNull();
    }
  });

  it('shifts light by the phase and clamps at both ends', () => {
    expect(applyPhase(0.5, 'day')).toBe(0.5);
    expect(applyPhase(0.5, 'dusk')).toBeCloseTo(0.5 + PHASE_OFFSET.dusk);
    expect(applyPhase(0.5, 'night')).toBeCloseTo(0.5 + PHASE_OFFSET.night);
    expect(applyPhase(1, 'dusk')).toBe(1);
    expect(applyPhase(0, 'night')).toBe(0);
    expect(applyPhase(0.05, 'dawn')).toBe(0);
  });

  it('leaves the room its own edge by day and lends it the sky otherwise', () => {
    expect(PHASE_EDGE.day).toBeNull();
    expect(PHASE_EDGE.dawn).not.toBe(PHASE_EDGE.night);
    expect(PHASE_EDGE.dusk).not.toBe(PHASE_EDGE.night);
    expect(PHASE_OFFSET.night).toBeLessThan(PHASE_OFFSET.dawn);
    expect(PHASE_OFFSET.dawn).toBeLessThan(PHASE_OFFSET.day);
    expect(PHASE_OFFSET.day).toBeLessThan(PHASE_OFFSET.dusk);
  });

  it('lights the Hall a sconce per honour', () => {
    expect(hallLight({ ...EMPTY, honours: 0 })).toBe(0);
    expect(hallLight({ ...EMPTY, honours: HONOUR_TOTAL })).toBe(1);
  });
});

describe('profile completeness', () => {
  it('is unknown without a profile', () => {
    expect(profileCompleteness(null)).toBeNull();
    expect(profileCompleteness(undefined)).toBeNull();
  });

  it('is zero for an empty profile and one for a full one', () => {
    expect(profileCompleteness({ photoUrls: [], bio: '' })).toBe(0);
    expect(profileCompleteness({
      photoUrls: ['a', 'b', 'c'], bio: 'hello',
      hasKids: false, smokingHabit: 'no', drinkingHabit: 'no', religion: 'none', lifestyle: 'active',
    })).toBe(1);
  });

  it('treats whitespace as no bio and counts a false deep field as answered', () => {
    expect(profileCompleteness({ photoUrls: [], bio: '   ' })).toBe(0);
    expect(profileCompleteness({ photoUrls: [], bio: '', hasKids: false })).toBeCloseTo(0.06);
  });

  it('does not exceed one when a user has more than three photos', () => {
    expect(profileCompleteness({ photoUrls: ['a', 'b', 'c', 'd', 'e'], bio: 'x' })).toBeCloseTo(0.7);
  });
});
