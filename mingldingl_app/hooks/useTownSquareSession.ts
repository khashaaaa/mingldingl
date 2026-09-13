import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { queryKeys } from '../lib/api/queryKeys';
import { signal } from '../lib/world/feedback';

export interface TownSquareNextSession {
  sessionId: string | null;
  rsvpOpensAt: string | null;
  rsvpClosesAt: string | null;
  scheduledStartAt: string | null;
  status: string | null;
  isRsvpd: boolean;
  /** Seats filled so far — the plaza's lantern count. */
  rsvpCount: number;
  /** Rounds this gathering will run — a bell each. */
  roundCount: number;
}

export function useTownSquareSession() {
  const qc = useQueryClient();
  const { data: session, isLoading, isError, error, refetch } = useQuery<TownSquareNextSession>({
    queryKey: queryKeys.townSquareNextSession,
    queryFn: async () => {
      const res = await apiClient.townSquare.nextSession();
      return {
        sessionId: res.sessionId ?? null,
        rsvpOpensAt: res.rsvpOpensAt ?? null,
        rsvpClosesAt: res.rsvpClosesAt ?? null,
        scheduledStartAt: res.scheduledStartAt ?? null,
        status: res.status ?? null,
        isRsvpd: res.isRsvpd ?? false,
        rsvpCount: res.rsvpCount ?? 0,
        roundCount: res.roundCount ?? 0,
      };
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.sessionId == null) return 60000;
      // Keep polling while a session runs: it is the only signal that tells this screen the
      // session has ended. Stopping here used to freeze the tab until the app was restarted.
      if (data.status === 'InProgress') return 30000;
      return 15000;
    },
    // town square tab renders its own error state and retry.
    meta: { silentError: true },
  });

  const sessionId = session?.sessionId ?? null;

  const shouldSubscribe = !!sessionId
    && session?.status !== 'InProgress'
    && session?.status !== 'Completed'
    && session?.status !== 'Cancelled';

  useEffect(() => {
    if (!sessionId || !shouldSubscribe) return;

    return subscribeWithRetry(
      () => supabase
        .channel(`townsquare:${sessionId}`)
        .on('broadcast', { event: 'session-started' }, () => {
          qc.invalidateQueries({ queryKey: queryKeys.townSquareNextSession });
        })
        .on('broadcast', { event: 'session-cancelled' }, () => {
          qc.invalidateQueries({ queryKey: queryKeys.townSquareNextSession });
        }),
      () => { qc.invalidateQueries({ queryKey: queryKeys.townSquareNextSession }); },
    );
  }, [sessionId, shouldSubscribe, qc]);

  const rsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.rsvp(sessionId),
    meta: { invalidates: [queryKeys.townSquareNextSession] },
    // The plaza's own lantern — lit the instant the RSVP lands, not on the next poll's re-render,
    // so the tap that lit it is the moment that rings.
    onSuccess: () => { signal('candleLit'); },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.cancelRsvp(sessionId),
    meta: { invalidates: [queryKeys.townSquareNextSession] },
  });

  return {
    session,
    isLoading,
    isError,
    error,
    refetch,
    rsvp: (sessionId: string) => rsvpMutation.mutate(sessionId),
    cancelRsvp: (sessionId: string) => cancelRsvpMutation.mutate(sessionId),
    isRsvping: rsvpMutation.isPending,
    isCancelling: cancelRsvpMutation.isPending,
  };
}
