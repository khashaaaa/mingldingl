import { BlurMask, Canvas, Circle, Path, useClock, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { TEMPERATURE } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The gate's scene: the cold that keeps it.
 *
 * - gather: a cluster of ice shards growing up out of the ground one after another, rime
 *   spreading along it.
 * - active: the ice holding — a glint running up each shard in turn, snow falling past it.
 * - settle: it shatters, the pieces thrown out and falling, and the gate opens.
 *
 * Drawn in the frost pole of `TEMPERATURE` — rime, ice, glacier — which is this scene's own
 * pigment the way the bonfire's is ember and gold.
 */

/** Each shard: base centre, half-width, height, lean of its tip, and when in the pull it grows. */
const SHARDS = [
  { x: 84, w: 9, h: 62, lean: 2, at: 0.0 },
  { x: 69, w: 7, h: 44, lean: -9, at: 0.15 },
  { x: 100, w: 7.5, h: 48, lean: 8, at: 0.25 },
  { x: 56, w: 5, h: 26, lean: -10, at: 0.4 },
  { x: 113, w: 5.5, h: 30, lean: 11, at: 0.48 },
  { x: 46, w: 3.5, h: 14, lean: -6, at: 0.6 },
  { x: 123, w: 4, h: 16, lean: 7, at: 0.65 },
] as const;

/** The pieces a shatter throws: which shard, direction, speed and spin. */
const SHARDS_PIECES = SHARDS.flatMap((_, i) => [
  { i, dx: -0.8 - (i % 3) * 0.3, dy: -1.4, v: 46 + i * 3 },
  { i, dx: 0.9 + (i % 2) * 0.4, dy: -1.1, v: 52 - i * 2 },
  { i, dx: (i % 2 ? 0.3 : -0.3), dy: -1.8, v: 40 + i * 4 },
]);

/** The snow: column, speed, phase and sway. */
const SNOW = [
  { x: 30, v: 0.00011, p: 0.0, sway: 5 }, { x: 58, v: 0.00014, p: 0.4, sway: 4 },
  { x: 92, v: 0.0001, p: 0.7, sway: 6 }, { x: 118, v: 0.00013, p: 0.2, sway: 4 },
  { x: 142, v: 0.00012, p: 0.55, sway: 5 }, { x: 74, v: 0.00015, p: 0.85, sway: 3 },
] as const;

export function IceShards({ height, gather, active, settle }: SceneProps) {
  const t = useClock();
  const ground = height - 10;

  /** How grown each shard is, 0 → 1, staggered across the pull. */
  const grown = (g: number, at: number) => {
    'worklet';
    return clamp01((g - at) / 0.35);
  };

  const shards = usePathValue((p) => {
    'worklet';
    if (settle.value > 0.02) return;
    const g = gather.value;
    for (const s of SHARDS) {
      const k = grown(g, s.at);
      if (k <= 0) continue;
      const h = s.h * k * (1 + 0.06 * Math.max(0, active.value - 1));
      p.moveTo(s.x - s.w, ground);
      p.lineTo(s.x - s.w * 0.55 + s.lean * 0.5, ground - h * 0.62);
      p.lineTo(s.x + s.lean, ground - h);
      p.lineTo(s.x + s.w * 0.6 + s.lean * 0.4, ground - h * 0.55);
      p.lineTo(s.x + s.w, ground);
      p.close();
    }
  });
  /** The facet down each shard, where the light breaks. */
  const facets = usePathValue((p) => {
    'worklet';
    if (settle.value > 0.02) return;
    const g = gather.value;
    for (const s of SHARDS) {
      const k = grown(g, s.at);
      if (k <= 0) continue;
      const h = s.h * k;
      p.moveTo(s.x + s.lean, ground - h);
      p.lineTo(s.x + s.w * 0.1, ground - 1);
    }
  });
  /** A glint climbing one shard at a time. */
  const glint = usePathValue((p) => {
    'worklet';
    const on = clamp01(active.value) * (1 - clamp01(settle.value * 4));
    if (on <= 0) return;
    const cycle = (t.value / 520) % SHARDS.length;
    const s = SHARDS[Math.floor(cycle)];
    const k = cycle % 1;
    const tipX = s.x + s.lean;
    const tipY = ground - s.h;
    const y0 = ground - s.h * k;
    const x0 = s.x + s.lean * k;
    p.moveTo(x0, y0);
    p.lineTo(x0 + (tipX - x0) * 0.25, y0 + (tipY - y0) * 0.25);
  });

  const rime = `M14 ${ground + 1}H${SCENE_W - 14}`;
  const rimeEnd = useDerivedValue(() => clamp01(gather.value * 1.3));
  const rimeOpacity = useDerivedValue(() => 1 - clamp01(settle.value));

  const pieces = usePathValue((p) => {
    'worklet';
    const s = settle.value;
    if (s <= 0.02) return;
    for (const f of SHARDS_PIECES) {
      const src = SHARDS[f.i];
      const x = src.x + f.dx * f.v * s;
      const y = ground - src.h * 0.45 + f.dy * f.v * s * 0.6 + 90 * s * s;
      const r = 2 + (f.i % 3);
      const spin = s * 6 + f.i;
      p.moveTo(x + Math.cos(spin) * r, y + Math.sin(spin) * r);
      p.lineTo(x + Math.cos(spin + 2.2) * r, y + Math.sin(spin + 2.2) * r);
      p.lineTo(x + Math.cos(spin + 4.1) * r * 0.7, y + Math.sin(spin + 4.1) * r * 0.7);
      p.close();
    }
  });
  const piecesOpacity = useDerivedValue(() => 1 - clamp01((settle.value - 0.4) / 0.6));

  const snow = usePathValue((p) => {
    'worklet';
    const on = clamp01(active.value) * (1 - clamp01(settle.value));
    if (on <= 0.05) return;
    for (const f of SNOW) {
      const k = (t.value * f.v + f.p) % 1;
      p.addCircle(f.x + Math.sin(k * 9 + f.p * 6) * f.sway, k * height, 1.3);
    }
  });
  const mistOpacity = useDerivedValue(() => 0.22 * clamp01(gather.value) * (1 - clamp01(settle.value)));

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Circle cx={SCENE_W / 2} cy={ground - 18} r={42} color={TEMPERATURE.glacier} opacity={mistOpacity}>
        <BlurMask blur={18} style="normal" />
      </Circle>
      <Path path={shards} color={TEMPERATURE.glacier} opacity={0.35} />
      <Path path={shards} style="stroke" strokeWidth={2} strokeJoin="round" color={TEMPERATURE.ice} />
      <Path path={facets} style="stroke" strokeWidth={1.1} strokeCap="round" color={TEMPERATURE.rime} opacity={0.7} />
      <Path path={glint} style="stroke" strokeWidth={2.4} strokeCap="round" color={TEMPERATURE.rime} />
      <Path path={rime} style="stroke" strokeWidth={2} strokeCap="round" color={TEMPERATURE.glacier} end={rimeEnd} opacity={rimeOpacity} />
      <Path path={pieces} color={TEMPERATURE.ice} opacity={piecesOpacity} />
      <Path path={snow} color={TEMPERATURE.rime} opacity={0.8} />
    </Canvas>
  );
}
