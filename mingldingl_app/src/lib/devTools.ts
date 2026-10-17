import { type Href, router } from 'expo-router';
import type { Belongs } from './gate';

/**
 * Developer tools exist only in development builds. Every door to them checks `__DEV__` in place —
 * Metro folds it to `false` in a release bundle and drops the branch, so the tools' code and
 * expo-dev-menu never ship.
 */
export const devToolsEnabled = () => __DEV__;

/** Adds "MingldIngl tools" to the Expo dev menu (shake, or the floating gear). */
export function registerDevTools(): boolean {
  if (!__DEV__) return false;
  const { registerDevMenuItems } = require('expo-dev-menu') as typeof import('expo-dev-menu');
  registerDevMenuItems([
    { name: 'MingldIngl tools', callback: () => router.push('/dev'), shouldCollapse: true },
  ]).catch(() => {});
  return true;
}

/** Each group's way in, for when there is no screen left to go back to. */
const ENTRY: Record<Belongs['group'], Href> = {
  loading: '/',
  out: '/(out)',
  closed: '/(closed)',
  onboarding: '/(onboarding)',
  world: '/(world)/(tabs)/character',
};

/**
 * Leaves the tools for the app. A seed state can move the gate to another group, which removes the
 * screen the tools opened over; `replace('/')` then silently does nothing, so name the group.
 */
export function leaveTools(group: Belongs['group']) {
  if (router.canGoBack()) router.back();
  else router.replace(ENTRY[group]);
}
