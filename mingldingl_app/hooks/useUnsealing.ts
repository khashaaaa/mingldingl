import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Watches a match's reveal level and reports the moment it *goes up*.
 *
 * The distinction that matters is between arriving at a conversation that is already partly
 * revealed and watching a seal break in front of you. Only the second is an event, so the first
 * level this hook ever sees for a match is recorded silently — otherwise every time chat mounted,
 * a match at level 3 would replay a ceremony it earned days ago.
 *
 * Switching matches resets the same way: the previous match's level says nothing about this one,
 * and comparing across them would fire on the way *down* as often as up.
 */
export function useUnsealing(matchId: string | undefined, revealLevel: number | undefined) {
  const [unsealed, setUnsealed] = useState(false);
  const seen = useRef<{ matchId: string; level: number } | null>(null);

  useEffect(() => {
    if (!matchId || revealLevel == null) return;
    const previous = seen.current;
    seen.current = { matchId, level: revealLevel };
    if (!previous || previous.matchId !== matchId) return;
    if (revealLevel > previous.level) setUnsealed(true);
  }, [matchId, revealLevel]);

  const dismiss = useCallback(() => setUnsealed(false), []);
  return { unsealed, dismiss };
}
