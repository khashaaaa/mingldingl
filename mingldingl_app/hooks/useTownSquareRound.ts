import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
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
    // Rounds cycle every ~4 min while the session is live — unlike a normal
    // "poll until terminal" query, there's no stopping condition here short
    // of the caller unmounting: a new pairingId is expected on every advance.
    // The broadcast effect below drives the common case within a second or
    // two of the actual transition; this interval is just the safety net for
    // a missed/best-effort broadcast (see SupabaseBroadcastService), so it
    // can be much slower than the old 5s straight poll.
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!sessionId) return;
    // TownSquareService.AdvanceRoundAsync pushes this after every automatic
    // round transition. Unlike chat/icebreaker/quiz, the transition isn't
    // triggered by either participant's own request — it's
    // TownSquareSchedulerBackgroundService's 10s sweep — so there's no
    // request handler to hang the broadcast off of; the service pushes it
    // directly to this session-scoped topic instead.
    const channel = supabase
      .channel(`townsquare:${sessionId}`)
      .on('broadcast', { event: 'round-advanced' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.townSquareCurrentRound(sessionId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

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
