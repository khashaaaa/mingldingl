import { useSyncExternalStore } from 'react';

/** The live connection counts as down only after this long, so a blink never shows "the road is cut". */
export const CUT_AFTER_MS = 5_000;

let cut = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const openers = new Set<() => void>();

function set(next: boolean) {
  if (cut === next) return;
  cut = next;
  for (const l of listeners) l();
  if (!next) for (const o of openers) o();
}

/** The live connection failed to start or dropped. */
export function roadDown() {
  if (cut || timer) return;
  timer = setTimeout(() => {
    timer = null;
    set(true);
  }, CUT_AFTER_MS);
}

/** The live connection is up — or was stopped on purpose (background, signed out), which is not a cut road. */
export function roadUp() {
  if (timer) clearTimeout(timer);
  timer = null;
  set(false);
}

export const isRoadCut = () => cut;

/** Runs each time the road opens again after being cut. */
export function onRoadOpen(f: () => void) {
  openers.add(f);
  return () => openers.delete(f);
}

export function useRoadCut() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cut,
  );
}
