import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * How much of an effect this device is allowed to draw.
 *
 * These used to be three levels where `reduced` meant two unrelated things at once — "there is no
 * Skia renderer here" (web) and "this person asked for less motion" (the OS setting) — and every
 * particle effect answered it by rendering *nothing*. The result was that the whole vfx layer was
 * blank on web, which is the surface the app is developed and E2E-tested on, so the effects were
 * effectively invisible to their own author.
 *
 * They are separate facts and they get separate levels:
 *
 * - `full`  — Skia is available and motion is welcome. Canvas effects, loops running.
 * - `plain` — no Skia renderer (web), but motion is welcome. React Native `Animated` fallbacks:
 *             fewer, cheaper, still moving.
 * - `still` — the OS reduce-motion setting is on, whatever the platform. Effects render their
 *             static form and start no loops; effects that *are* nothing but motion render
 *             nothing, because a still ember is not a dim ember, it is a speck of dust.
 * - `off`   — the build-time kill switch. Nothing at all.
 *
 * Precedence is off > still > plain > full: a person's accessibility setting outranks what the
 * renderer happens to be capable of.
 */
export type VfxLevel = 'full' | 'plain' | 'still' | 'off';

export function resolveVfxLevel(platform: string, reduceMotion: boolean): 'full' | 'plain' | 'still' {
  if (reduceMotion) return 'still';
  // Skia has no CanvasKit/WASM setup in this app, so its Canvas cannot mount in a browser.
  if (platform === 'web') return 'plain';
  return 'full';
}

/** True when this level may run a repeating animation at all. */
export function motionAllowed(level: VfxLevel): boolean {
  return level === 'full' || level === 'plain';
}

export function useVfxLevel(): VfxLevel {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  if (process.env.EXPO_PUBLIC_VFX === 'off') return 'off';
  return resolveVfxLevel(Platform.OS, reduceMotion);
}
