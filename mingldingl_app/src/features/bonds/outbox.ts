import { useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api/client';
import { writeLetter } from '@/lib/api/generated/engine';
import { t, tError } from '@/lib/i18n';
import { lettersKey } from '@/lib/live/events';
import { isRoadCut, onRoadOpen } from '@/lib/live/road';
import { queryClient } from '@/lib/query';
import { toast } from '@/lib/toast';

/**
 * Letters written while the road is cut. Held in memory only (a letter never outlives the app on
 * disk) and sent in the order written when the road opens; each shows as unsent until then.
 */
export type Unsent = { key: string; bondId: string; text: string };

let queue: Unsent[] = [];
let flushing = false;
let seq = 0;
let retry: ReturnType<typeof setTimeout> | null = null;

/** A request can fail while the live connection still stands; then nothing reopens the road, so try again. */
const RETRY_MS = 5_000;
function retryLater() {
  if (retry || isRoadCut()) return;
  retry = setTimeout(() => {
    retry = null;
    flushOutbox();
  }, RETRY_MS);
}
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** Sends now, or holds the letter when the road is cut (or cuts while sending). False: the engine refused it. */
export async function sendLetter(bondId: string, text: string): Promise<boolean> {
  if (isRoadCut() || queue.length > 0) {
    hold(bondId, text);
    return true;
  }
  try {
    await writeLetter(bondId, { text });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'network') {
      hold(bondId, text);
      return true;
    }
    throw e;
  }
}

function hold(bondId: string, text: string) {
  queue = [...queue, { key: `unsent-${++seq}`, bondId, text }];
  emit();
  retryLater();
}

/** Oldest first; stops at the first that cannot go yet, drops one the engine refuses (and says why). */
export async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const next = queue[0] as Unsent;
      try {
        await writeLetter(next.bondId, { text: next.text });
        // The unsent letter stays on screen until the bond has the sent one, so it never blinks out.
        await queryClient.refetchQueries({ queryKey: lettersKey(next.bondId) }).catch(() => {});
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'network') {
          retryLater();
          return;
        }
        toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
      }
      queue = queue.slice(1);
      emit();
    }
  } finally {
    flushing = false;
  }
}

onRoadOpen(flushOutbox);

const empty: Unsent[] = [];
const cache = new Map<string, { from: Unsent[]; mine: Unsent[] }>();

/** This bond's unsent letters, oldest first. */
export function useUnsent(bondId: string): Unsent[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      const hit = cache.get(bondId);
      if (hit?.from === queue) return hit.mine;
      const mine = queue.some((u) => u.bondId === bondId) ? queue.filter((u) => u.bondId === bondId) : empty;
      cache.set(bondId, { from: queue, mine });
      return mine;
    },
  );
}

/** Tests only. */
export function resetOutbox() {
  if (retry) clearTimeout(retry);
  retry = null;
  queue = [];
  cache.clear();
  emit();
}
