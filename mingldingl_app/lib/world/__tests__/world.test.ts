import fs from 'fs';
import path from 'path';
import {
  DEFAULT_ROOM, PASSAGES, ROOMS, isUnlit, matchRoom, pathOf, roomFor,
} from '../rooms';
import {
  HEARTH_FULL, HONOUR_TOTAL, LIGHT, clamp01, delveLight, forgeLight, hallLight, hearthLight,
  lerp, profileCompleteness, roadLight, tavernLight, type WorldState,
} from '../light';

const EMPTY: WorldState = {
  budget: null, activeMatches: null, tavern: null, delve: null, profile: null, honours: null,
};

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
      expect(recipe.washAlpha[1]).toBeGreaterThanOrEqual(recipe.washAlpha[0]);
    }
  });

  it('keeps the Deep the darkest room and the Tavern the most open', () => {
    expect(LIGHT.dark.vignette[0]).toBeGreaterThan(LIGHT.warm.vignette[0]);
    expect(LIGHT.warm.vignette[0]).toBeLessThan(LIGHT.cold.vignette[0]);
    expect(LIGHT.dark.floor[0]).toBeGreaterThan(LIGHT.cold.floor[0]);
  });

  it('tells rooms apart without tinting them: every wash is the same colour', () => {
    const washes = new Set(Object.values(LIGHT).map((r) => r.wash));
    expect(washes.size).toBe(1);
  });

  it('leaves an unlit room with no film over it', () => {
    for (const recipe of Object.values(LIGHT)) {
      expect(recipe.washAlpha[0]).toBe(0);
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
