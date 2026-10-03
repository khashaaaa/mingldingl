import { Canvas, Circle, Group, Path, useClock, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { INK, METAL } from '../../../lib/theme';
import { clamp01, SCENE_W, type SceneProps } from './shared';

/**
 * The tavern's scene: the mill on the rise behind it, grinding.
 *
 * - gather: the hill and the mill brushed in, the sails turned a quarter by the pull itself.
 * - active: the wind gets up — the sails turn, streaks of wind cross the hill, chaff flies.
 * - settle: the wind drops and the sails slow to a stop.
 *
 * The sails are integrated frame by frame rather than read off the clock, so a change of speed
 * (the wind getting up, dying away) never jumps them to a new angle.
 */

const SAIL_LEN = 31;
/** A full turn at full wind. */
const TURN_MS = 2600;

/** The wind's streaks: height, length, speed and phase. */
const GUSTS = [
  { y: 22, len: 26, v: 0.00016, p: 0 },
  { y: 40, len: 18, v: 0.00022, p: 0.45 },
  { y: 58, len: 22, v: 0.00019, p: 0.75 },
] as const;
/** Chaff blown off the stones. */
const CHAFF = [
  { y: 66, v: 0.0003, p: 0.1, wob: 4 }, { y: 70, v: 0.00026, p: 0.5, wob: 6 },
  { y: 62, v: 0.00034, p: 0.8, wob: 3 }, { y: 72, v: 0.00029, p: 0.3, wob: 5 },
] as const;

export function Mill({ height, gather, active, settle }: SceneProps) {
  const t = useClock();
  const ground = height - 8;
  const cx = SCENE_W / 2;
  const hub = { x: cx, y: ground - 46 };

  const spin = useSharedValue(0);
  const wind = useDerivedValue(() => clamp01(active.value) * (1 - clamp01(settle.value)));
  useFrameCallback((frame) => {
    const dt = frame.timeSincePreviousFrame ?? 16;
    spin.value += (dt / TURN_MS) * Math.PI * 2 * wind.value * Math.max(1, active.value);
  });
  const sailAngle = useDerivedValue(() => spin.value + clamp01(gather.value) * (Math.PI / 2));

  const hill = `M8 ${ground + 4}Q${cx} ${ground - 14} ${SCENE_W - 8} ${ground + 4}`;
  const tower =
    `M${cx - 13} ${ground - 4}L${cx - 9} ${hub.y + 4}H${cx + 9}L${cx + 13} ${ground - 4}Z`;
  const cap = `M${cx - 11} ${hub.y + 5}Q${cx} ${hub.y - 10} ${cx + 11} ${hub.y + 5}`;
  const door = `M${cx - 4} ${ground - 4}V${ground - 11}Q${cx} ${ground - 15} ${cx + 4} ${ground - 11}V${ground - 4}`;

  const drawn = useDerivedValue(() => clamp01(gather.value * 1.6));
  const sailsOpacity = useDerivedValue(() => clamp01((gather.value - 0.35) / 0.4));

  const sails = usePathValue((p) => {
    'worklet';
    const a0 = sailAngle.value;
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i * Math.PI) / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      // The stock, hub to tip...
      p.moveTo(hub.x + ux * 3, hub.y + uy * 3);
      p.lineTo(hub.x + ux * SAIL_LEN, hub.y + uy * SAIL_LEN);
      // ...and the cloth on its trailing side, a frame with two battens.
      const nx = -uy * 7;
      const ny = ux * 7;
      const r0 = 9;
      p.moveTo(hub.x + ux * r0, hub.y + uy * r0);
      p.lineTo(hub.x + ux * r0 + nx, hub.y + uy * r0 + ny);
      p.lineTo(hub.x + ux * SAIL_LEN + nx, hub.y + uy * SAIL_LEN + ny);
      p.lineTo(hub.x + ux * SAIL_LEN, hub.y + uy * SAIL_LEN);
      for (const r of [16, 23]) {
        p.moveTo(hub.x + ux * r, hub.y + uy * r);
        p.lineTo(hub.x + ux * r + nx, hub.y + uy * r + ny);
      }
    }
  });

  const gusts = usePathValue((p) => {
    'worklet';
    if (wind.value < 0.05) return;
    for (const g of GUSTS) {
      const k = (t.value * g.v + g.p) % 1;
      const x = -30 + k * (SCENE_W + 60);
      const len = g.len * wind.value;
      p.moveTo(x, g.y);
      p.quadTo(x + len * 0.5, g.y - 3, x + len, g.y);
    }
  });
  const chaff = usePathValue((p) => {
    'worklet';
    if (wind.value < 0.05) return;
    for (const c of CHAFF) {
      const k = (t.value * c.v + c.p) % 1;
      const x = cx + 6 + k * 70;
      const y = c.y - k * 26 + Math.sin(k * 12) * c.wob;
      p.addCircle(x, y, 1.1);
    }
  });

  return (
    <Canvas style={{ width: SCENE_W, height }} pointerEvents="none">
      <Path path={gusts} style="stroke" strokeWidth={1.4} strokeCap="round" color={INK.muted} opacity={0.6} />
      <Path path={hill} style="stroke" strokeWidth={2.6} strokeCap="round" color={METAL.brassDeep} end={drawn} />
      <Path path={tower} style="stroke" strokeWidth={2.8} strokeJoin="round" color={METAL.brass} end={drawn} />
      <Path path={cap} style="stroke" strokeWidth={2.8} strokeCap="round" color={METAL.brass} end={drawn} />
      <Path path={door} style="stroke" strokeWidth={2} strokeCap="round" color={METAL.brass} end={drawn} />
      <Group opacity={sailsOpacity}>
        <Path path={sails} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={INK.primary} />
        <Circle cx={hub.x} cy={hub.y} r={3.4} color={METAL.gold} />
      </Group>
      <Path path={chaff} color={METAL.gold} opacity={wind} />
    </Canvas>
  );
}
