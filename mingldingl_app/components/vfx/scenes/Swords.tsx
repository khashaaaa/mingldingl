import { BlurMask, Canvas, Circle, Group, Path, useClock, usePathValue, type Transforms3d } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { INK, METAL } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The hall's scene: two blades meeting.
 *
 * - gather: the swords drawn up out of the ground, from lowered to on guard.
 * - active: the clash — drawn back, swung in, steel on steel and a flash where they meet.
 * - settle: lowered into a crossed rest, the crest the hall hangs over its door.
 */

/** A sword standing on its hilt at the origin, blade up. */
const BLADE = 'M-2.6 -3L-2.6 -51L0 -60L2.6 -51L2.6 -3Z';
const FULLER = 'M0 -7V-47';
const GUARD = 'M-10 -1.5Q0 2.5 10 -1.5';
const GRIP = 'M0 1V11';

/** On guard, not yet touching. */
const READY = 0.3;
/** Drawn back for the swing. */
const BACK = -0.05;
/** Where the blades cross: the moment of the clash, and the angle they rest at. */
const MEET = 0.62;
/** Lowered, before they are drawn. */
const LOWERED = -0.55;
const CLASH_MS = 1000;
/** A clash: drawn back until DRAW, swung in until SWING, then locked and grinding to the end. */
const DRAW = 0.4;
const SWING = 0.55;

export function Swords({ height, gather, active, settle }: SceneProps) {
  const t = useClock();
  const hilt = height - 12;
  const left = { x: 52, y: hilt };
  const right = { x: 116, y: hilt };
  // Where two blades turned to MEET cross, on the centre line.
  const reach = (SCENE_W / 2 - left.x) / Math.sin(MEET);
  const contact = { x: SCENE_W / 2, y: hilt - reach * Math.cos(MEET) };

  const u = useDerivedValue(() => (t.value % CLASH_MS) / CLASH_MS);
  const working = useDerivedValue(() => clamp01(active.value) * (1 - clamp01(settle.value * 2)));

  const angle = useDerivedValue(() => {
    const k = u.value;
    let clash: number;
    if (k < DRAW) {
      const e = Math.sin((k / DRAW) * Math.PI / 2);
      clash = MEET + (BACK - MEET) * e;
    } else if (k < SWING) {
      const e = ((k - DRAW) / (SWING - DRAW)) ** 2;
      clash = BACK + (MEET - BACK) * e;
    } else {
      // Locked: blade pressing on blade, giving a little and taking it back.
      clash = MEET + 0.025 * Math.sin((k - SWING) * 40) * (1 - k);
    }
    const drawn = LOWERED + (READY - LOWERED) * clamp01(gather.value);
    const w = working.value;
    const now = drawn * (1 - w) + clash * w;
    const s = clamp01(settle.value);
    return now * (1 - s) + MEET * s;
  });

  /** How bright the meeting is: a flash at the moment of contact, falling away. */
  const flash = useDerivedValue(() => {
    const age = u.value >= SWING ? u.value - SWING : u.value + 1 - SWING;
    return working.value * Math.exp(-age * 7) * Math.min(1.5, Math.max(1, active.value));
  });

  const sparks = usePathValue((p) => {
    'worklet';
    const f = flash.value;
    if (f < 0.05) return;
    const age = u.value >= SWING ? u.value - SWING : u.value + 1 - SWING;
    if (age > 0.3) return;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI + (i + 0.5) * (Math.PI / 8) + (i % 2 ? 0.15 : -0.1);
      const d0 = 5 + age * 110;
      const d1 = d0 + 6 * f;
      p.moveTo(contact.x + Math.cos(a) * d0, contact.y + Math.sin(a) * d0 + age * age * 80);
      p.lineTo(contact.x + Math.cos(a) * d1, contact.y + Math.sin(a) * d1 + age * age * 80);
    }
  });
  const star = usePathValue((p) => {
    'worklet';
    const r = 3 + 11 * flash.value;
    if (flash.value < 0.05) return;
    const { x, y } = contact;
    p.moveTo(x, y - r);
    p.quadTo(x + r * 0.16, y - r * 0.16, x + r, y);
    p.quadTo(x + r * 0.16, y + r * 0.16, x, y + r);
    p.quadTo(x - r * 0.16, y + r * 0.16, x - r, y);
    p.quadTo(x - r * 0.16, y - r * 0.16, x, y - r);
    p.close();
  });
  const glowR = useDerivedValue(() => 6 + 22 * flash.value);
  const glowOpacity = useDerivedValue(() => 0.5 * Math.min(1, flash.value));

  const drawn = useDerivedValue(() => clamp01(gather.value * 1.5));
  const leftHold = useDerivedValue<Transforms3d>(() => [{ translateX: left.x }, { translateY: left.y }, { rotate: angle.value }]);
  const rightHold = useDerivedValue<Transforms3d>(() => [{ translateX: right.x }, { translateY: right.y }, { rotate: -angle.value }]);
  const floor = `M28 ${hilt + 8}H140`;

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Path path={floor} style="stroke" strokeWidth={2} strokeCap="round" color={METAL.brassDeep} opacity={drawn} />
      <Sword transform={leftHold} drawn={drawn} />
      <Sword transform={rightHold} drawn={drawn} />
      <Circle cx={contact.x} cy={contact.y} r={glowR} color={METAL.gold} opacity={glowOpacity}>
        <BlurMask blur={10} style="normal" />
      </Circle>
      <Path path={star} color={INK.primary} />
      <Path path={sparks} style="stroke" strokeWidth={1.5} strokeCap="round" color={METAL.gold} />
    </Canvas>
  );
}

function Sword({ transform, drawn }: {
  transform: SharedValue<Transforms3d>; drawn: SharedValue<number>;
}) {
  return (
    <Group transform={transform}>
      <Path path={BLADE} style="stroke" strokeWidth={2} strokeJoin="round" color={INK.primary} end={drawn} />
      <Path path={FULLER} style="stroke" strokeWidth={1} strokeCap="round" color={INK.dim} end={drawn} />
      <Path path={GUARD} style="stroke" strokeWidth={3.2} strokeCap="round" color={METAL.brass} />
      <Path path={GRIP} style="stroke" strokeWidth={3.4} strokeCap="round" color={METAL.brassDeep} />
      <Circle cx={0} cy={14} r={2.6} color={METAL.brass} />
    </Group>
  );
}
