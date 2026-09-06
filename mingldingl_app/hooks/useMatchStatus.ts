import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import type { MatchStatus } from '../models/match';

/** Why an open conversation stopped accepting messages, or null while it is still live. */
export type MatchEndedReason = 'ghosted' | 'ended';

export function endedReasonFor(status: MatchStatus | undefined): MatchEndedReason | null {
  if (!status || status === 'Active' || status === 'Pending') return null;
  return status === 'Ghosted' ? 'ghosted' : 'ended';
}

/**
 * The lifecycle of one match, from three sources that all write the same cache entry:
 *
 *  - this query, on entering the chat (`ghost-check` also *runs* the ghosting rule, so it is the
 *    one call that can flip a silent match to Ghosted);
 *  - `useRealtimeNudges`, when the engine broadcasts `match_status_changed` — that is how a partner
 *    unmatching or blocking mid-conversation reaches a screen the match list no longer contains;
 *  - `useChat`, when a send comes back 403 `match.inactive`, so the truth still surfaces on a
 *    device whose realtime socket is down.
 *
 * Without it the chat screen simply kept accepting text into a match that was gone: the reveal strip
 * vanished with the match list entry and every send failed to a bare "tap to retry".
 */
export function useMatchStatus(matchId: string) {
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: queryKeys.matchStatus(matchId),
    queryFn: async () => {
      const res = await apiClient.matches.ghostCheck(matchId);
      return (res.status as MatchStatus | undefined) ?? 'Active';
    },
    enabled: !!matchId,
    // Re-checked on every entry into the chat; between entries the broadcast keeps it honest, so
    // there is nothing to gain from refetching on focus.
    refetchOnWindowFocus: false,
    retry: false,
    meta: { silentError: true },
  });

  return {
    status,
    endedReason: endedReasonFor(status),
    /** Clears the cached status so the next entry into this chat re-checks from the engine. */
    reset: () => qc.removeQueries({ queryKey: queryKeys.matchStatus(matchId) }),
  };
}
