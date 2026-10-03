import { Canvas, Circle, Group, Path, BlurMask, useClock, usePathValue, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { HEAT, INK, METAL } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The hearth's scene: a fire laid, struck and kept, then let go.
 *
 * - gather: the two logs brushed in one after the other, then the flint struck over them —
 *   sparks, and an ember glowing where the logs cross.
 * - active: the fire, caught (a flare past 1 on the catch) and burning.
 * - settle: a curl of smoke rising off the logs and fading.
 *
 * Drawn in the glyphs' pigments, not in new ones: the brass of the wood, the ember and gold of
 * the fire, and the ink's own light at its heart. `furnace` stays off — the guard in
 * `lib/__tests__/furnace.test.ts` keeps that heat for the few moments that earn it.
 */

/** The embers that leave the fire while it burns: horizontal offset, speed and phase. */
const EMBERS = [
  { dx: -6, speed: 0.00042, phase: 0.0, drift: 7 },
  { dx: 4, speed: 0.00055, phase: 0.35, drift: -6 },
  { dx: -2, speed: 0.00048, phase: 0.62, drift: 9 },
  { dx: 8, speed: 0.0006, phase: 0.18, drift: -8 },
  { dx: -10, speed: 0.0005, phase: 0.82, drift: 5 },
  { dx: 1, speed: 0.00066, phase: 0.5, drift: -4 },
] as const;

/** The flint's sparks: the angle each one flies at, and how far. */
const SPARKS = [
  { a: -2.5, len: 9 }, { a: -1.9, len: 12 }, { a: -1.35, len: 8 }, { a: -0.8, len: 11 },
  { a: -0.35, len: 7 }, { a: -2.85, len: 7 }, { a: -1.6, len: 14 },
] as const;

/**
 * One tongue of flame, as a filled teardrop: a round foot on the logs, swelling sides, a tip
 * pulled sideways by `sway`.
 */
function tongue(p: SkPath, cx: number, base: number, w: number, h: number, sway: number) {
  'worklet';
  if (h <= 0.5) return;
  p.moveTo(cx - w, base);
  p.cubicTo(cx - w * 1.05, base - h * 0.42, cx - w * 0.45 + sway * 0.4, base - h * 0.72, cx + sway, base - h);
  p.cubicTo(cx + w * 0.45 + sway * 0.4, base - h * 0.72, cx + w * 1.05, base - h * 0.42, cx + w, base);
  p.quadTo(cx, base + w * 0.5, cx - w, base);
  p.close();
}

export function Bonfire({ height, gather: laid, active: burn, settle: smoke }: SceneProps) {
  const t = useClock();
  const cx = SCENE_W / 2;
  /** The ground the logs lie on. */
  const ground = height - 12;
  /** Where the logs cross, and where the fire stands. */
  const heart = ground - 7;

  // The logs, each a brushed stroke laid in turn.
  const logA = `M${cx - 34} ${ground + 1}L${cx + 28} ${ground - 13}`;
  const logB = `M${cx + 34} ${ground + 1}L${cx - 28} ${ground - 13}`;
  const stones =
    `M${cx - 50} ${ground + 4}Q${cx - 44} ${ground - 1} ${cx - 38} ${ground + 4}` +
    `M${cx + 38} ${ground + 4}Q${cx + 44} ${ground - 1} ${cx + 50} ${ground + 4}` +
    `M${cx - 58} ${ground + 6}H${cx + 58}`;
  const endA = useDerivedValue(() => clamp01(laid.value * 1.8));
  const endB = useDerivedValue(() => clamp01(laid.value * 1.8 - 0.55));
  const stonesOpacity = useDerivedValue(() => clamp01(laid.value * 2) * 0.55);

  // The flint: sparks thrown off the crossing once the pull is most of the way there, flickering
  // on and off as if struck again and again, gone the moment the fire takes.
  const sparks = usePathValue((p) => {
    'worklet';
    const strike = clamp01((laid.value - 0.55) / 0.45) * (1 - clamp01(burn.value * 3));
    if (strike <= 0) return;
    const beat = Math.floor(t.value / 70);
    for (let i = 0; i < SPARKS.length; i++) {
      // A cheap hash of the beat, so each spark has its own on/off rhythm.
      const lit = ((beat * 7 + i * 13) % 5) < 2;
      if (!lit) continue;
      const s = SPARKS[i];
      const r0 = 3 + ((beat + i) % 3);
      const r1 = r0 + s.len * strike;
      p.moveTo(cx + Math.cos(s.a) * r0, heart + Math.sin(s.a) * r0);
      p.lineTo(cx + Math.cos(s.a) * r1, heart + Math.sin(s.a) * r1);
    }
  });

  // The ember the sparks feed before it catches.
  const coalR = useDerivedValue(() => 2 + clamp01((laid.value - 0.4) / 0.6) * 4 + burn.value * 3);
  const coalOpacity = useDerivedValue(() => clamp01((laid.value - 0.4) / 0.6) * 0.9 * (1 - clamp01(smoke.value * 1.4)));

  // The fire: three layers of tongues, each swaying on its own two beats so the shape never
  // repeats quickly enough to read as a loop.
  const flameH = (scale: number) => {
    'worklet';
    const ms = t.value;
    return burn.value * scale * (44 + Math.sin(ms * 0.0071) * 3 + Math.sin(ms * 0.0173) * 2);
  };
  const sway = (k: number) => {
    'worklet';
    const ms = t.value;
    return Math.sin(ms * 0.0042 + k) * 4 + Math.sin(ms * 0.0113 + k * 2) * 2;
  };
  const outer = usePathValue((p) => {
    'worklet';
    const h = flameH(1);
    tongue(p, cx, heart + 3, 15 * Math.min(1, burn.value), h, sway(0));
    tongue(p, cx - 9, heart + 3, 7 * Math.min(1, burn.value), h * 0.62, sway(1.7) - 3);
    tongue(p, cx + 10, heart + 3, 6.5 * Math.min(1, burn.value), h * 0.55, sway(3.1) + 3);
  });
  const middle = usePathValue((p) => {
    'worklet';
    tongue(p, cx, heart + 2, 10 * Math.min(1, burn.value), flameH(0.7), sway(0.6));
  });
  const core = usePathValue((p) => {
    'worklet';
    tongue(p, cx, heart + 1, 5.5 * Math.min(1, burn.value), flameH(0.38), sway(1.1) * 0.6);
  });
  const glowR = useDerivedValue(() => 30 * Math.min(1.2, burn.value) + Math.sin(t.value * 0.009) * 2);
  const glowOpacity = useDerivedValue(() => 0.28 * Math.min(1, burn.value));

  // Smoke as it goes out: one curl rising off the logs, drawn up and then thinning from the base.
  const smokePath = usePathValue((p) => {
    'worklet';
    const s = smoke.value;
    if (s <= 0) return;
    const rise = 18 + s * 46;
    const wob = Math.sin(t.value * 0.004) * 3;
    p.moveTo(cx, heart);
    p.cubicTo(cx - 9 + wob, heart - rise * 0.3, cx + 10 - wob, heart - rise * 0.6, cx - 2 + wob, heart - rise);
  });
  const smokeStart = useDerivedValue(() => clamp01(smoke.value * 1.2 - 0.25));
  const smokeOpacity = useDerivedValue(() => 0.55 * (1 - clamp01((smoke.value - 0.55) / 0.45)));

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Circle cx={cx} cy={heart - 10} r={glowR} color={METAL.gold} opacity={glowOpacity}>
        <BlurMask blur={16} style="normal" />
      </Circle>
      <Path path={stones} style="stroke" strokeWidth={2} strokeCap="round" color={METAL.brassDeep} opacity={stonesOpacity} />
      <Path path={logA} style="stroke" strokeWidth={5.5} strokeCap="round" color={METAL.brass} end={endA} />
      <Path path={logB} style="stroke" strokeWidth={5.5} strokeCap="round" color={METAL.brass} end={endB} />
      <Circle cx={cx} cy={heart} r={coalR} color={HEAT.flame} opacity={coalOpacity}>
        <BlurMask blur={4} style="solid" />
      </Circle>
      <Group>
        <Path path={outer} color={METAL.ember} />
        <Path path={middle} color={METAL.gold} />
        <Path path={core} color={INK.primary} opacity={0.85} />
      </Group>
      <Path path={sparks} style="stroke" strokeWidth={1.6} strokeCap="round" color={METAL.gold} />
      {EMBERS.map((e, i) => <RisingEmber key={i} cfg={e} cx={cx} base={heart - 6} t={t} burn={burn} />)}
      <Path path={smokePath} style="stroke" strokeWidth={3} strokeCap="round" color={INK.muted} start={smokeStart} opacity={smokeOpacity} />
    </Canvas>
  );
}

function RisingEmber({ cfg, cx, base, t, burn }: {
  cfg: typeof EMBERS[number]; cx: number; base: number; t: SharedValue<number>; burn: SharedValue<number>;
}) {
  const life = useDerivedValue(() => (t.value * cfg.speed + cfg.phase) % 1);
  const x = useDerivedValue(() => cx + cfg.dx + Math.sin(life.value * Math.PI * 2) * cfg.drift * life.value);
  const y = useDerivedValue(() => base - life.value * 58);
  const opacity = useDerivedValue(() => clamp01(burn.value) * (life.value < 0.15 ? life.value / 0.15 : 1 - life.value));
  return <Circle cx={x} cy={y} r={1.5} color={METAL.gold} opacity={opacity} />;
}
