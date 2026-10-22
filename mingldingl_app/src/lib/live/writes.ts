/**
 * The app's own writes, each named by a random id the engine hands back with the live events it
 * caused (`X-Live-Origin`). An echo of our own write waits for the write's answer, so a screen that
 * put the answer in the cache is not made to fetch the same thing again.
 */
export const ORIGIN_HEADER = 'X-Live-Origin';

export type OwnWrite = { start: number; done: Promise<void> };

const writes = new Map<string, OwnWrite>();
let n = 0;

/** Called by the API client for every write; `end` once its answer is back (or it failed). */
export function beginWrite(): { id: string; end: () => void } {
  n += 1;
  const id = `${Date.now().toString(36)}-${n.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let end = () => {};
  const done = new Promise<void>((resolve) => {
    end = resolve;
  });
  writes.set(id, { start: Date.now(), done });
  return {
    id,
    end: () => {
      end();
      // Long enough for its echo to arrive after the answer; then forgotten.
      setTimeout(() => writes.delete(id), 30_000);
    },
  };
}

export const ownWrite = (origin: string | null | undefined): OwnWrite | undefined =>
  origin ? writes.get(origin) : undefined;
