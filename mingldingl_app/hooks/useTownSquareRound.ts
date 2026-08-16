import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
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
    // Rounds cycle every ~4 min while the session is live — unlike a normal
    // "poll until terminal" query, there's no stopping condition here short
    // of the caller unmounting: a new pairingId is expected on every advance.
    refetchInterval: 5000,
  });

  const markJoinedMutation = useMutation({
    mutationFn: (pairingId: string) => apiClient.townSquare.joined(pairingId),
  });

  const respondMutation = useMutation({
    mutationFn: ({ pairingId, response }: { pairingId: string; response: 'Yes' | 'No' }) =>
      apiClient.townSquare.respond(pairingId, response),
  });

  function submitResponse(pairingId: string, response: 'Yes' | 'No') {
    if (respondMutation.isPending) return;
    respondMutation.mutate({ pairingId, response });
  }

  // Deriving "responded" from whether the last mutation's pairingId still
  // matches the currently displayed round — rather than tracking a separate
  // reset flag — means this naturally clears itself once the round advances
  // to a new pairing, with no explicit reset wiring needed.
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
