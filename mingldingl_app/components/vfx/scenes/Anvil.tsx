import { BlurMask, Canvas, Circle, Group, Path, RoundedRect, useClock, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { HEAT, INK, METAL } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The forge's scene: a bar worked on the anvil.
 *
 * - gather: the anvil brushed in, the bar on it heating from iron to gold, the hammer lifted.
 * - active: the hammer falling and rising, a fan of sparks thrown off every blow.
 * - settle: the bar cooling, the hammer laid down, steam off the quench.
 */

/** The hammer turns about the smith's hand, off to the right. */
const PIVOT = { x: 150, y: 44 };
/** How far the hammer is lifted at the top of a swing, in radians. */
const LIFT = 0.78;
/** One blow, raise and fall. */
const SWING_MS = 820;
/** The fraction of a swing spent raising; the rest is the fall. */
const RAISE = 0.68;

/** The sparks thrown by a blow: the angle each one flies at, and how fast. */
const SPARKS = [
  { a: -2.9, v: 1.1 }, { a: -2.55, v: 1.5 }, { a: -2.2, v: 1.25 }, { a: -1.9, v: 1.7 },
  { a: -1.55, v: 1.05 }, { a: -1.25, v: 1.6 }, { a: -0.95, v: 1.3 }, { a: -0.6, v: 1.45 },
  { a: -0.3, v: 1.15 },
] as const;

export function Anvil({ height, gather, active, settle }: SceneProps) {
  const t = useClock();
  const ground = height - 10;
  /** The anvil's face, where the bar lies and the hammer lands. */
  const face = ground - 30;
  const strike = { x: 94, y: face - 5 };

  const anvil =
    `M46 ${face}H112C121 ${face} 128 ${face - 3} 131 ${face - 7}C131 ${face + 2} 124 ${face + 8} 114 ${face + 8}` +
    `H104V${face + 14}C104 ${face + 18} 108 ${face + 20} 113 ${face + 21}V${ground}H63V${face + 21}` +
    `C68 ${face + 20} 72 ${face + 18} 72 ${face + 14}V${face + 8}H58C51 ${face + 8} 47 ${face + 4} 46 ${face}Z`;
  const floor = `M30 ${ground + 2}H138`;
  const handle = `M${PIVOT.x} ${PIVOT.y}L${strike.x + 4} ${PIVOT.y}`;
  const head = `M${strike.x - 4} ${face - 25}H${strike.x + 9}V${face - 6}H${strike.x - 4}Z`;

  const drawn = useDerivedValue(() => clamp01(gather.value * 1.6));
  const floorOpacity = useDerivedValue(() => clamp01(gather.value * 2) * 0.5);

  /** Where in the current blow the hammer is, 0 at the moment it lands. */
  const swing = useDerivedValue(() => (t.value % SWING_MS) / SWING_MS);
  const working = useDerivedValue(() => clamp01(active.value) * (1 - clamp01(settle.value * 2)));

  const angle = useDerivedValue(() => {
    const u = swing.value;
    const blow = u < RAISE
      ? -LIFT * Math.sin((u / RAISE) * Math.PI / 2)
      : -LIFT * (1 - ((u - RAISE) / (1 - RAISE)) ** 2);
    // Pulled: lifted as far as the pull has gone. Working: swinging. Settled: laid down.
    const held = -LIFT * clamp01(gather.value) * 0.85;
    const w = working.value;
    return (held * (1 - w) + blow * w) * (1 - clamp01(settle.value));
  });
  // Skia turns clockwise on screen, and a head left of the hand rises when turned clockwise.
  const hammer = useDerivedValue(() => [{ rotate: -angle.value }]);
  const hammerOpacity = useDerivedValue(() => clamp01((gather.value - 0.3) / 0.4));

  // How hot the bar is: warming as it is pulled, white-gold while worked, going back to iron.
  const heat = useDerivedValue(() =>
    Math.max(clamp01(gather.value) * 0.45, clamp01(active.value)) * (1 - clamp01(settle.value * 1.3)));
  const glowR = useDerivedValue(() => 16 + heat.value * 14 + (working.value > 0 && swing.value < 0.12 ? 8 : 0));
  const glowOpacity = useDerivedValue(() => heat.value * 0.35);

  const sparks = usePathValue((p) => {
    'worklet';
    const age = swing.value;
    const w = working.value * Math.min(1.4, Math.max(1, active.value));
    if (w <= 0 || age > 0.4) return;
    for (let i = 0; i < SPARKS.length; i++) {
      const s = SPARKS[i];
      const d = 4 + age * 95 * s.v * w;
      const fall = age * age * 60;
      const x0 = strike.x + Math.cos(s.a) * (d - 7);
      const y0 = strike.y + Math.sin(s.a) * (d - 7) + fall * 0.8;
      p.moveTo(x0, y0);
      p.lineTo(strike.x + Math.cos(s.a) * d, strike.y + Math.sin(s.a) * d + fall);
    }
  });
  const sparkOpacity = useDerivedValue(() => 1 - swing.value / 0.4);

  const steam = usePathValue((p) => {
    'worklet';
    const s = settle.value;
    if (s <= 0) return;
    for (let k = 0; k < 2; k++) {
      const x = strike.x - 8 + k * 14;
      const rise = 10 + s * 40;
      const wob = Math.sin(t.value * 0.005 + k * 2) * 3;
      p.moveTo(x, face - 6);
      p.cubicTo(x - 6 + wob, face - 6 - rise * 0.35, x + 7 - wob, face - 6 - rise * 0.65, x + wob, face - 6 - rise);
    }
  });
  const steamOpacity = useDerivedValue(() => 0.5 * (1 - clamp01((settle.value - 0.5) / 0.5)));

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Circle cx={strike.x} cy={face - 2} r={glowR} color={HEAT.flame} opacity={glowOpacity}>
        <BlurMask blur={14} style="normal" />
      </Circle>
      <Path path={floor} style="stroke" strokeWidth={2} strokeCap="round" color={METAL.brassDeep} opacity={floorOpacity} />
      <Path path={anvil} style="stroke" strokeWidth={3.2} strokeJoin="round" strokeCap="round" color={METAL.brass} end={drawn} />
      <RoundedRect x={strike.x - 16} y={face - 5} width={30} height={5} r={2} color={METAL.brassDeep} opacity={drawn} />
      <RoundedRect x={strike.x - 16} y={face - 5} width={30} height={5} r={2} color={METAL.gold} opacity={heat}>
        <BlurMask blur={1.5} style="solid" />
      </RoundedRect>
      <Group origin={PIVOT} transform={hammer} opacity={hammerOpacity}>
        <Path path={handle} style="stroke" strokeWidth={4} strokeCap="round" color={METAL.brass} />
        <Path path={head} color={INK.dim} />
        <Path path={head} style="stroke" strokeWidth={2} strokeJoin="round" color={METAL.brass} />
      </Group>
      <Path path={sparks} style="stroke" strokeWidth={1.6} strokeCap="round" color={METAL.gold} opacity={sparkOpacity} />
      <Path path={steam} style="stroke" strokeWidth={2.6} strokeCap="round" color={INK.muted} opacity={steamOpacity} />
    </Canvas>
  );
}
