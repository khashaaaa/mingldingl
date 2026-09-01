import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { queryKeys } from '../lib/api/queryKeys';

export interface TownSquareNextSession {
  sessionId: string | null;
  rsvpOpensAt: string | null;
  rsvpClosesAt: string | null;
  scheduledStartAt: string | null;
  status: string | null;
  isRsvpd: boolean;
}

export function useTownSquareSession() {
  const qc = useQueryClient();
  const { data: session, isLoading, isError, refetch } = useQuery<TownSquareNextSession>({
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
  }, [sessionId, shouldSubscribe]);

  const rsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.rsvp(sessionId),
    meta: { invalidates: [queryKeys.townSquareNextSession] },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.cancelRsvp(sessionId),
    meta: { invalidates: [queryKeys.townSquareNextSession] },
  });

  return {
    session,
    isLoading,
    isError,
    refetch,
    rsvp: (sessionId: string) => rsvpMutation.mutate(sessionId),
    cancelRsvp: (sessionId: string) => cancelRsvpMutation.mutate(sessionId),
    isRsvping: rsvpMutation.isPending,
    isCancelling: cancelRsvpMutation.isPending,
  };
}
