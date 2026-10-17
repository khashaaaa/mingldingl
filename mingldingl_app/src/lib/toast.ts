import { useSyncExternalStore } from 'react';
import type { ToastKind } from '@/design/components/Toast';

export type ToastItem = { id: number; kind: ToastKind; message: string };

const SHOW_MS = 3500;
const MAX = 3;
let items: ToastItem[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => {
  for (const s of subs) s();
};

/** Shows a toast for a few seconds. At most three at once; the oldest leaves first. */
export function toast(kind: ToastKind, message: string) {
  const id = nextId++;
  items = [...items, { id, kind, message }].slice(-MAX);
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, SHOW_MS);
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => items,
  );
}
