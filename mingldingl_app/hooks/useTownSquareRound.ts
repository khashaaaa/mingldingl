import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { queryKeys } from '../lib/api/queryKeys';

export interface TownSquareRound {
  pairingId: string;
  videoToken: string;
  channelName: string;
  appId: string;
  icebreakerId: string;
  icebreakerText: string;
  icebreakerType: string;
  icebreakerOptions: string[];
  roundNumber: number;
  roundEndsAt: string;
}

export function useTownSquareRound(sessionId: string | undefined) {
  const qc = useQueryClient();

  const { data: round, isLoading, error } = useQuery<TownSquareRound>({
    queryKey: queryKeys.townSquareCurrentRound(sessionId ?? ''),
    queryFn: async () => {
      const res = await apiClient.townSquare.currentRound(sessionId!);
      return {
        pairingId: res.pairingId ?? '',
        videoToken: res.videoToken ?? '',
        channelName: res.channelName ?? '',
        appId: res.appId ?? '',
        icebreakerId: res.icebreakerId ?? '',
        icebreakerText: res.icebreakerText ?? '',
        icebreakerType: res.icebreakerType ?? '',
        icebreakerOptions: res.icebreakerOptions ?? [],
        roundNumber: res.roundNumber ?? 0,
        roundEndsAt: res.roundEndsAt ?? '',
      };
    },
    enabled: !!sessionId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!sessionId) return;

    return subscribeWithRetry(
      () => supabase
        .channel(`townsquare:${sessionId}`)
        .on('broadcast', { event: 'round-advanced' }, () => {
          qc.invalidateQueries({ queryKey: queryKeys.townSquareCurrentRound(sessionId) });
        }),
      () => { qc.invalidateQueries({ queryKey: queryKeys.townSquareCurrentRound(sessionId) }); },
    );
  }, [sessionId]);

  const markJoinedMutation = useMutation({
    mutationFn: (pairingId: string) => apiClient.townSquare.joined(pairingId),
    meta: { invalidates: [queryKeys.matches] },
  });

  const respondMutation = useMutation({
    mutationFn: ({ pairingId, response }: { pairingId: string; response: 'Yes' | 'No' }) =>
      apiClient.townSquare.respond(pairingId, response),
    meta: { invalidates: [queryKeys.matches] },
  });

  function submitResponse(pairingId: string, response: 'Yes' | 'No') {
    if (respondMutation.isPending) return;
    respondMutation.mutate({ pairingId, response });
  }

  const hasResponded = respondMutation.isSuccess && respondMutation.variables?.pairingId === round?.pairingId;

  return {
    round,
    isLoading,
    error,
    markJoined: (pairingId: string) => markJoinedMutation.mutate(pairingId),
    submitResponse,
    hasResponded,
    matchId: hasResponded ? respondMutation.data?.matchId ?? null : null,
  };
}
