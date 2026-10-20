import type { Fire } from './rooms';

/** Sparks per fire: the ember is alive (Lit), roaring at the Hearth and the Flame Rite, gone when cold. */
export const SPARKS_FOR: Record<Fire, number> = { Lit: 14, Roaring: 28, Out: 0 };

export type Spark = {
  x0: number;
  speed: number;
  sway: number;
  swayHz: number;
  phase: number;
  delay: number;
  life: number;
  size: number;
};

/** Mulberry32: a tiny seeded PRNG so the field is the same every launch (and testable). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Each spark gets its own speed, sway and delay — never one baked sprite sliding up. */
export function sparkField(seed: number, count: number, width: number, height: number): Spark[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const speed = 0.018 + r() * 0.03 + i * 1e-5; // px per ms
    return {
      x0: width * (0.12 + r() * 0.76),
      speed,
      sway: 6 + r() * 14,
      swayHz: 0.25 + r() * 0.45,
      phase: r() * Math.PI * 2,
      delay: r() * 5000,
      life: (height * (0.55 + r() * 0.4)) / speed,
      size: 0.8 + r() * 1.6,
    };
  });
}

/** Position and opacity of one spark at time t (ms since the field started), rising from the band's foot. */
export function sparkAt(s: Spark, t: number, height: number): { x: number; y: number; opacity: number } {
  'worklet';
  const local = (((t - s.delay) % s.life) + s.life) % s.life;
  const p = local / s.life;
  const y = height - local * s.speed;
  const x = s.x0 + Math.sin(s.phase + (local / 1000) * s.swayHz * Math.PI * 2) * s.sway;
  // Fade in over the first 15%, out over the last 45%.
  const opacity = t < s.delay ? 0 : Math.min(p / 0.15, 1) * Math.min((1 - p) / 0.45, 1);
  return { x, y, opacity };
}
