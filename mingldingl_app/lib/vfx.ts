import { useSyncExternalStore } from 'react';
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

/**
 * The OS reduce-motion setting, read once for the whole app. Every caller used to ask Android for
 * it on its own mount and add its own listener — two dozen components, a list row and a skeleton
 * among them — so opening a screen queued a native round trip per row and then re-rendered each
 * one when the answers came back.
 */
let reduceMotion = false;
let subscribed = false;
const listeners = new Set<() => void>();

function setReduceMotion(next: boolean): void {
  if (next === reduceMotion) return;
  reduceMotion = next;
  for (const l of listeners) l();
}

function subscribeReduceMotion(listener: () => void): () => void {
  listeners.add(listener);
  if (!subscribed) {
    subscribed = true;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  }
  return () => { listeners.delete(listener); };
}

const readReduceMotion = () => reduceMotion;

export function useVfxLevel(): VfxLevel {
  const reduce = useSyncExternalStore(subscribeReduceMotion, readReduceMotion, readReduceMotion);
  if (process.env.EXPO_PUBLIC_VFX === 'off') return 'off';
  return resolveVfxLevel(Platform.OS, reduce);
}

/** Test seam: forget the shared subscription so each test starts from the OS default. */
export function __resetVfxLevel(): void {
  reduceMotion = false;
  subscribed = false;
  listeners.clear();
}
