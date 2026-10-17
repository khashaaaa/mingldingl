/**
 * The tier-up ceremony's one clock, in ms from its start (Figma 36:88 → 36:147 → 36:201):
 * darkness 400 → the old gem cracks 600 → it shatters into a beam of the new tier's light →
 * the new gem is forged and rises 1.2 s → its name ink-bleeds in 360 ms → the line, then Continue.
 * Every function here is a worklet, read on the UI thread by Skia and Reanimated alike.
 */
export const AT = {
  dark: 0,
  crack: 400,
  shatter: 1000,
  beamFull: 1250,
  beamFold: 1750,
  forge: 1900,
  risen: 3100,
  name: 3100,
  line: 3460,
  ready: 3700,
} as const;

/** 0 → 1 as `t` crosses [a, b], held at the ends. */
export function seg(t: number, a: number, b: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

export function easeOutCubic(p: number): number {
  'worklet';
  return 1 - (1 - p) ** 3;
}

export function easeInCubic(p: number): number {
  'worklet';
  return p * p * p;
}

/** Overshoots a little past 1 and settles — the gem landing on its setting. */
export function easeOutBack(p: number): number {
  'worklet';
  const c = 1.70158;
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
}

/** The old gem: fades in from the dark, trembles harder as it cracks, gone at the shatter. */
export function oldGem(t: number) {
  'worklet';
  const shake = easeInCubic(seg(t, AT.crack, AT.shatter));
  return {
    opacity: t >= AT.shatter ? 0 : 0.85 * seg(t, AT.dark, AT.crack),
    scale: 0.92 + 0.08 * easeOutCubic(seg(t, AT.dark, AT.crack)) + 0.04 * shake,
    x: Math.sin(t * 0.11) * 5 * shake,
    y: Math.cos(t * 0.17) * 2 * shake,
  };
}

/** The new gem: forged in the beam, rising onto its place, then breathing there. */
export function newGem(t: number) {
  'worklet';
  const p = seg(t, AT.forge, AT.risen);
  const idle = t > AT.risen ? Math.sin((t - AT.risen) / 900) * 4 : 0;
  return {
    opacity: seg(t, AT.forge, AT.forge + 300),
    scale: t < AT.forge ? 0.55 : 0.55 + 0.45 * easeOutBack(p),
    y: (1 - easeOutCubic(p)) * 90 + idle,
  };
}

/** The beam: drops from the top, holds, then folds into the gem as it is forged. */
export function beam(t: number) {
  'worklet';
  const drop = easeOutCubic(seg(t, AT.shatter, AT.beamFull));
  const fold = easeInCubic(seg(t, AT.beamFold, AT.forge + 200));
  return {
    reach: drop,
    width: 70 * (1 + 0.5 * seg(t, AT.beamFull, AT.beamFold)) * (1 - fold),
    opacity: t < AT.shatter ? 0 : 1 - fold,
  };
}

/** A ring of light thrown out when the gem is forged. */
export function shockwave(t: number, maxR: number) {
  'worklet';
  const p = seg(t, AT.forge, AT.forge + 900);
  return {
    r: 40 + easeOutCubic(p) * maxR,
    opacity: p === 0 || p === 1 ? 0 : 0.8 * (1 - p),
    width: 2 + 10 * (1 - p),
  };
}

/** One full-screen flash at the shatter, and a softer one at the forge. */
export function flash(t: number) {
  'worklet';
  const a = t >= AT.shatter ? 0.75 * (1 - seg(t, AT.shatter, AT.shatter + 280)) : 0;
  const b = t >= AT.forge ? 0.35 * (1 - seg(t, AT.forge, AT.forge + 400)) : 0;
  return Math.max(a, b);
}

export type Shard = {
  angle: number;
  speed: number;
  spin: number;
  size: number;
  points: number[];
  core: boolean;
};

/** The old gem's pieces: the same every time (a seeded walk), so the ceremony reads as designed. */
export function shards(n: number, seed = 7): Shard[] {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: n }, (_, i) => {
    const size = 6 + rnd() * 12;
    const sides = 3 + Math.floor(rnd() * 2);
    const points: number[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + rnd() * 0.6;
      const r = size * (0.6 + rnd() * 0.4);
      points.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return {
      angle: (i / n) * Math.PI * 2 + rnd() * 0.5,
      speed: 260 + rnd() * 340,
      spin: (rnd() - 0.5) * 12,
      size,
      points,
      core: rnd() < 0.5,
    };
  });
}

/** Where a shard is `t` ms into the ceremony: flung out at the shatter, falling, fading. */
export function shardAt(sh: Shard, t: number) {
  'worklet';
  const s = Math.max(0, t - AT.shatter) / 1000;
  return {
    x: Math.cos(sh.angle) * sh.speed * s,
    y: Math.sin(sh.angle) * sh.speed * s + 520 * s * s,
    rotate: sh.spin * s,
    opacity: t < AT.shatter ? 0 : 1 - seg(t, AT.shatter + 300, AT.shatter + 1300),
  };
}

export type Mote = { x: number; phase: number; speed: number; size: number; drift: number };

export function motes(n: number, seed = 3): Mote[] {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: n }, () => ({
    x: (rnd() - 0.5) * 2,
    phase: rnd(),
    speed: 0.6 + rnd() * 0.8,
    size: 1.5 + rnd() * 2.5,
    drift: (rnd() - 0.5) * 30,
  }));
}

/** Motes of the new tier's light rising around the gem once it is forged, each on its own loop. */
export function moteAt(m: Mote, t: number, spread: number, rise: number) {
  'worklet';
  const life = ((t / 2600) * m.speed + m.phase) % 1;
  return {
    x: m.x * spread + Math.sin(life * Math.PI * 2) * m.drift,
    y: rise * (0.5 - life),
    opacity: seg(t, AT.forge, AT.forge + 600) * Math.sin(life * Math.PI) * 0.9,
  };
}
