import { useEffect, useRef } from 'react';
import { signal } from '../lib/world/feedback';
import type { FireState } from '../lib/fire';

/**
 * The one moment a thread going quiet gets to say so out loud.
 *
 * The chat screen renders `embers` on every paint the fire is in that state, but the world should
 * only speak the instant it is first seen there — a rerender, a message that arrives while it is
 * still embers, or a fire that has since frozen must not ring it again. Tracked per match in a
 * ref, the same way `useSealedLetter` remembers which letter it has already unsealed, so this is
 * one component's own memory rather than a fact that needs to survive a remount.
 */
export function useFireDying(matchId: string | undefined, fireState: FireState): void {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!matchId || fireState !== 'embers' || seen.current.has(matchId)) return;
    seen.current.add(matchId);
    signal('fireDying');
  }, [matchId, fireState]);
}
