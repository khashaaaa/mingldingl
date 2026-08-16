import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
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

  const { data: session, isLoading } = useQuery<TownSquareNextSession>({
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
    // Once the session goes live there's nothing left to RSVP-poll for — the
    // live round screen takes over with its own (much faster) round polling.
    refetchInterval: (query) => (query.state.data?.status === 'InProgress' ? false : 15000),
  });

  const rsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.rsvp(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.townSquareNextSession }),
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.cancelRsvp(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.townSquareNextSession }),
  });

  return {
    session,
    isLoading,
    rsvp: (sessionId: string) => rsvpMutation.mutate(sessionId),
    cancelRsvp: (sessionId: string) => cancelRsvpMutation.mutate(sessionId),
    isRsvping: rsvpMutation.isPending,
    isCancelling: cancelRsvpMutation.isPending,
  };
}
