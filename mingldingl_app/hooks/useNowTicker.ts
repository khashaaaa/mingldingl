import { useEffect, useState } from 'react';

/** Dawns turn over at local midnight, not every second — a minute's staleness on "how many
 *  dawns of silence" is invisible, so there is no reason to re-render on every tick. */
export const NOW_REFRESH_MS = 60_000;

/**
 * The current instant, refreshed on an interval rather than every render.
 *
 * A fire's state (`lib/fire.ts`) is purely time-driven — burning becomes embers the moment a
 * dawn turns over, with no message or query to trigger a re-render — so anything computing one
 * needs `now` to actually change on its own while the screen sits open. Originally the Quest
 * Log's own `useState` + `setInterval`; the chat screen (Task 4 fix round 1) needed the identical
 * ticker, so it moved here rather than being copied a second time.
 */
export function useNowTicker(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
