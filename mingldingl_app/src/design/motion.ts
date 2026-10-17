import { useSyncExternalStore } from 'react';
import { Easing, useReducedMotion } from 'react-native-reanimated';
import spec from './figma/motion.json';
import { duration, easing } from './tokens';

/** M7: loops stop, ceremonies cut to their last frame, everything else becomes a short fade. */
export type Reduced = 'stop' | 'lastFrame' | 'fade';
export type MotionName =
  | 'press'
  | 'inkBleedIn'
  | 'dryBrushDraw'
  | 'sheetRise'
  | 'roomTravel'
  | 'sealStamp'
  | 'sealBreak'
  | 'emberFlare'
  | 'candle'
  | 'emberDrift'
  | 'frostCreep'
  | 'rewardBurst'
  | 'honourDrop'
  | 'chestOpen'
  | 'bell'
  | 'gemIdle'
  | 'tierUp';

export type Motion = {
  duration: number;
  /** Departures take 75% of the arrival (M3). */
  exit: number;
  loop?: { min: number; max: number };
  easing: keyof typeof easing | null;
  reduced: Reduced;
};

const NAMED: Record<string, number> = { tap: duration.tap, shift: duration.shift, travel: duration.travel };

function parse(time: string): { duration: number; loop?: { min: number; max: number } } {
  if (time === 'loop')
    return { duration: duration.loopMin, loop: { min: duration.loopMin, max: duration.loopMax } };
  if (time.includes('-')) {
    const [min, max] = time.split('-').map(Number) as [number, number];
    return { duration: min, loop: { min, max } };
  }
  return { duration: time.split('+').reduce((sum, part) => sum + (NAMED[part] ?? Number(part)), 0) };
}

const LOOPS = new Set(['candle', 'emberDrift', 'gemIdle']);

export const MOTION = Object.fromEntries(
  spec.motions.map((m) => {
    const { duration: d, loop } = parse(m.time);
    const reduced: Reduced = LOOPS.has(m.key) ? 'stop' : d >= 600 ? 'lastFrame' : 'fade';
    return [
      m.key,
      { duration: d, exit: duration.exit(d), loop, easing: m.easing as Motion['easing'], reduced },
    ];
  }),
) as Record<MotionName, Motion>;

/** null follows the system setting; true / false force it (the developer menu's switch). */
let reduceOverride: boolean | null = null;
const reduceListeners = new Set<() => void>();
const getOverride = () => reduceOverride;

export function setReduceMotionOverride(v: boolean | null) {
  reduceOverride = v;
  for (const fn of reduceListeners) fn();
}

export function useReduceMotionOverride(): boolean | null {
  return useSyncExternalStore(
    (fn) => {
      reduceListeners.add(fn);
      return () => reduceListeners.delete(fn);
    },
    getOverride,
    getOverride,
  );
}

/** Reduce Motion as the app obeys it: the system setting unless the developer menu forces one. */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  return useReduceMotionOverride() ?? system;
}

/** A Figma easing as a Reanimated easing (the spring `anvil` has no curve; it reads as forgeOut). */
export function curve(name: keyof typeof easing | null) {
  const c = name && name !== 'anvil' ? easing[name] : easing.forgeOut;
  return Easing.bezier(c[0], c[1], c[2], c[3]);
}
