import type { SharedValue } from 'react-native-reanimated';

/**
 * A scene: one small animated painting a room shows while it holds a long wait (`LongWait`).
 * Every scene is the same three movements:
 *
 * - `gather` 0 → 1: the thing being made ready — logs laid, a hammer raised, swords drawn.
 * - `active` 0 → 1: the work, looping for as long as the wait lasts. The catch overshoots past
 *   1 for a beat (a flare, a first strike) and every scene may use that.
 * - `settle` 0 → 1: the work let go — smoke, steam, a shatter — once the wait is over.
 */
export interface SceneProps {
  height: number;
  gather: SharedValue<number>;
  active: SharedValue<number>;
  settle: SharedValue<number>;
}

/** Every scene is painted on the same canvas width, centred over whatever it sits above. */
export const SCENE_W = 168;

export function clamp01(v: number) {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
