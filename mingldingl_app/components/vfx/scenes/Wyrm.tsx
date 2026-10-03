import { BlurMask, Canvas, Circle, Group, Path, useClock, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { HEAT, INK, METAL, SURFACE } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The deep's scene: something under the hold, woken.
 *
 * - gather: a wyrm's head rising out of the dark — coils breaking the ground on either side,
 *   horns and brow brushed in, eyes still shut.
 * - active: the eyes open, gold with a slit, looking one way and the other; it blinks, and its
 *   breath smokes from the nostrils.
 * - settle: the eyes close and it sinks back under.
 *
 * The body is drawn in the muted ink so it reads as a shape in the dark rather than a creature
 * lit up; only the eyes carry colour.
 */

const BLINK_MS = 3100;
const BREATH_MS = 1900;

export function Wyrm({ height, gather, active, settle }: SceneProps) {
  const t = useClock();
  const ground = height - 6;
  const cx = SCENE_W / 2;
  const eyeY = ground - 34;
  const eyes = [cx - 15, cx + 15] as const;

  // The skull, broad at the temples and narrowing to the jaw.
  const head =
    `M${cx - 20} ${ground}C${cx - 24} ${ground - 12} ${cx - 33} ${eyeY + 6} ${cx - 30} ${eyeY - 6}` +
    `L${cx - 20} ${eyeY - 13}L${cx - 6} ${eyeY - 9}L${cx} ${eyeY - 16}L${cx + 6} ${eyeY - 9}L${cx + 20} ${eyeY - 13}` +
    `L${cx + 30} ${eyeY - 6}C${cx + 33} ${eyeY + 6} ${cx + 24} ${ground - 12} ${cx + 20} ${ground}`;
  // Horns swept back off the temples, hooked at the tips; a shorter spur under each.
  const horns =
    `M${cx - 22} ${eyeY - 12}C${cx - 34} ${eyeY - 16} ${cx - 44} ${eyeY - 12} ${cx - 50} ${eyeY - 28}` +
    `M${cx + 22} ${eyeY - 12}C${cx + 34} ${eyeY - 16} ${cx + 44} ${eyeY - 12} ${cx + 50} ${eyeY - 28}` +
    `M${cx - 29} ${eyeY - 3}L${cx - 40} ${eyeY - 6}M${cx + 29} ${eyeY - 3}L${cx + 40} ${eyeY - 6}`;
  // Brows down hard toward the snout: the anger is in the V.
  const brows =
    `M${cx - 27} ${eyeY - 7}L${cx - 5} ${eyeY + 1}M${cx + 27} ${eyeY - 7}L${cx + 5} ${eyeY + 1}`;
  const snout =
    `M${cx - 6} ${ground - 15}L${cx - 3} ${ground - 13}M${cx + 6} ${ground - 15}L${cx + 3} ${ground - 13}` +
    `M${cx - 15} ${ground - 7}Q${cx} ${ground - 3} ${cx + 15} ${ground - 7}`;
  const fangs =
    `M${cx - 10} ${ground - 6}L${cx - 8} ${ground + 1}L${cx - 6} ${ground - 5}Z` +
    `M${cx + 10} ${ground - 6}L${cx + 8} ${ground + 1}L${cx + 6} ${ground - 5}Z`;
  const coils =
    `M6 ${ground}C12 ${ground - 22} 30 ${ground - 24} 38 ${ground}` +
    `M${SCENE_W - 6} ${ground}C${SCENE_W - 12} ${ground - 26} ${SCENE_W - 32} ${ground - 26} ${SCENE_W - 40} ${ground}`;
  /** Spines along the coils' backs. */
  const scales =
    `M13 ${ground - 12}L13 ${ground - 20}L18 ${ground - 15}M20 ${ground - 16}L22 ${ground - 25}L26 ${ground - 17}` +
    `M28 ${ground - 13}L32 ${ground - 20}L33 ${ground - 10}` +
    `M${SCENE_W - 14} ${ground - 13}L${SCENE_W - 14} ${ground - 22}L${SCENE_W - 19} ${ground - 17}` +
    `M${SCENE_W - 22} ${ground - 18}L${SCENE_W - 24} ${ground - 28}L${SCENE_W - 28} ${ground - 19}` +
    `M${SCENE_W - 31} ${ground - 15}L${SCENE_W - 35} ${ground - 22}L${SCENE_W - 36} ${ground - 11}`;

  // It rises with the pull and sinks as it settles.
  const sunk = useDerivedValue(() => (1 - clamp01(gather.value)) * 30 + clamp01(settle.value) * 34);
  const rise = useDerivedValue(() => [{ translateY: sunk.value }]);
  const drawn = useDerivedValue(() => clamp01(gather.value * 1.4));

  /** 0 shut, 1 wide. Opens once it is up, blinks while awake, shuts as it settles. */
  const open = useDerivedValue(() => {
    const awake = clamp01((gather.value - 0.75) / 0.25) * 0.25 + clamp01(active.value) * 0.75;
    const b = (t.value % BLINK_MS) / BLINK_MS;
    const blink = b > 0.94 ? Math.abs(b - 0.97) / 0.03 : 1;
    return clamp01(awake * (active.value > 0.2 ? blink : 1) * (1 - clamp01(settle.value * 2.5)));
  });
  const look = useDerivedValue(() => Math.sin(t.value * 0.0017) * 3.2 + Math.sin(t.value * 0.0049) * 1.2);

  const lids = usePathValue((p) => {
    'worklet';
    const o = open.value;
    if (o < 0.04) return;
    for (const x of eyes) {
      // The inner corner sits lower than the outer: the eyes slant down toward the snout.
      const inward = x < cx ? 1 : -1;
      const xo = x - inward * 8;
      const xi = x + inward * 8;
      p.moveTo(xo, eyeY - 3);
      p.quadTo(x, eyeY - 3 - 6 * o, xi, eyeY + 2);
      p.quadTo(x, eyeY + 2 + 3.5 * o, xo, eyeY - 3);
      p.close();
    }
  });
  const pupils = usePathValue((p) => {
    'worklet';
    const o = open.value;
    if (o < 0.25) return;
    // Wider when it first wakes (the catch), narrowing to a slit.
    const w = 1.1 + Math.max(0, active.value - 1) * 6;
    for (const x of eyes) {
      const px = x + look.value;
      p.moveTo(px, eyeY - 5 * o);
      p.quadTo(px + w, eyeY, px, eyeY + 3.6 * o);
      p.quadTo(px - w, eyeY, px, eyeY - 5 * o);
      p.close();
    }
  });
  /** Shut, the eyes are a line each. */
  const shut = usePathValue((p) => {
    'worklet';
    if (open.value >= 0.04 || gather.value < 0.5) return;
    for (const x of eyes) {
      p.moveTo(x - 7, eyeY);
      p.quadTo(x, eyeY + 2, x + 7, eyeY);
    }
  });
  const glowOpacity = useDerivedValue(() => 0.45 * open.value);

  const breath = usePathValue((p) => {
    'worklet';
    const on = clamp01(active.value) * (1 - clamp01(settle.value * 2));
    if (on <= 0.05) return;
    const k = (t.value % BREATH_MS) / BREATH_MS;
    if (k > 0.6) return;
    const r = 2 + k * 10;
    const y = ground - 15 - k * 26;
    p.addCircle(cx - 8 - k * 10, y, r);
    p.addCircle(cx + 8 + k * 10, y, r);
  });
  const breathOpacity = useDerivedValue(() => {
    const k = (t.value % BREATH_MS) / BREATH_MS;
    return 0.35 * (1 - k / 0.6) * clamp01(active.value);
  });

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Group transform={rise}>
        <Path path={coils} style="stroke" strokeWidth={3.4} strokeCap="round" color={INK.muted} end={drawn} />
        <Path path={scales} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" color={INK.muted} opacity={drawn} />
        <Path path={horns} style="stroke" strokeWidth={4} strokeCap="round" color={INK.dim} end={drawn} />
        <Path path={head} style="stroke" strokeWidth={3} strokeCap="round" color={INK.muted} end={drawn} />
        <Path path={brows} style="stroke" strokeWidth={2.4} strokeCap="round" color={INK.dim} end={drawn} />
        <Path path={snout} style="stroke" strokeWidth={1.8} strokeCap="round" color={INK.muted} end={drawn} />
        <Path path={fangs} color={INK.dim} opacity={drawn} />
        <Circle cx={eyes[0]} cy={eyeY} r={11} color={HEAT.flame} opacity={glowOpacity}>
          <BlurMask blur={9} style="normal" />
        </Circle>
        <Circle cx={eyes[1]} cy={eyeY} r={11} color={HEAT.flame} opacity={glowOpacity}>
          <BlurMask blur={9} style="normal" />
        </Circle>
        <Path path={shut} style="stroke" strokeWidth={1.8} strokeCap="round" color={INK.dim} />
        <Path path={lids} color={METAL.gold} />
        <Path path={pupils} color={SURFACE.ground} />
        <Path path={breath} color={INK.muted} opacity={breathOpacity}>
          <BlurMask blur={3} style="normal" />
        </Path>
      </Group>
    </Canvas>
  );
}
