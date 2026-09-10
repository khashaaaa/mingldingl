import { useSyncExternalStore } from 'react';

/**
 * What this session remembers about itself that no query owns.
 *
 * The only entry so far is the *reforged* tint: after a tier-up ceremony the hold's floor takes
 * on the new gem's colour for the rest of the session, so the ascent is still visible after the
 * modal is gone. It is deliberately not persisted — the tint is the afterglow of a moment, and a
 * moment that survives a restart is just a theme. Nothing here is React state either: the world
 * layer reads it through `useSyncExternalStore` so a screen never re-renders over it.
 */
type Listener = () => void;

let reforgedTint: string | null = null;
const listeners = new Set<Listener>();

export function setReforgedTint(color: string | null): void {
  if (reforgedTint === color) return;
  reforgedTint = color;
  for (const listener of listeners) listener();
}

export function getReforgedTint(): string | null {
  return reforgedTint;
}

/** `useSyncExternalStore`-shaped: returns the unsubscribe. */
export function subscribeToReforgedTint(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useReforgedTint(): string | null {
  return useSyncExternalStore(subscribeToReforgedTint, getReforgedTint, getReforgedTint);
}

/** Tests only: every session starts with no afterglow. */
export function __resetSession(): void {
  reforgedTint = null;
  listeners.clear();
}
