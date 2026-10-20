import { rng } from './sparks';

export type Flake = {
  x0: number;
  r: number;
  speed: number;
  sway: number;
  swayHz: number;
  phase: number;
  offset: number;
};

/** One depth layer of snow: the far flakes small and slow, the near ones larger and quicker. */
export type SnowLayer = { count: number; r: number[]; speed: number[]; opacity: number; blur?: number };

/** A layer's flakes, seeded so the fall is the same every launch (and testable). */
export function flakeField(seed: number, layer: SnowLayer, width: number, travel: number): Flake[] {
  const r = rng(seed);
  const [r0 = 1, r1 = r0] = layer.r;
  const [v0 = 0.03, v1 = v0] = layer.speed;
  return Array.from({ length: layer.count }, () => {
    const speed = v0 + r() * (v1 - v0); // px per ms
    return {
      x0: width * r(),
      r: r0 + r() * (r1 - r0),
      speed,
      sway: 8 + r() * 16,
      swayHz: 0.08 + r() * 0.2,
      phase: r() * Math.PI * 2,
      // Already part-way down at launch, so the sky is never empty while the first flakes fall.
      offset: r() * (travel / speed),
    };
  });
}

/**
 * Where one flake is at time t (ms): falling from just above the top to `floor`, swaying, and over
 * its last `melt` of the way shrinking to nothing — snow melting as it falls into the ember's glow.
 */
export function flakeAt(
  f: Flake,
  t: number,
  floor: number,
  melt: number,
): { x: number; y: number; r: number } {
  'worklet';
  const travel = floor + f.r * 2;
  const life = travel / f.speed;
  const local = (t + f.offset) % life;
  const p = local / life;
  const y = -f.r * 2 + local * f.speed;
  const x = f.x0 + Math.sin(f.phase + (local / 1000) * f.swayHz * Math.PI * 2) * f.sway;
  const r = melt > 0 ? f.r * Math.min((1 - p) / melt, 1) : f.r;
  return { x, y, r };
}
