import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { queryKeys } from '../lib/api/queryKeys';

export interface TownSquareRound {
  pairingId: string;
  /** Who the caller is sitting opposite. A stranger, so the only way to report them is here. */
  partnerUserId: string;
  videoToken: string;
  channelName: string;
  appId: string;
  icebreakerText: string;
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
        partnerUserId: res.partnerUserId ?? '',
        videoToken: res.videoToken ?? '',
        channelName: res.channelName ?? '',
        appId: res.appId ?? '',
        icebreakerText: res.icebreakerText ?? '',
        roundNumber: res.roundNumber ?? 0,
        roundEndsAt: res.roundEndsAt ?? '',
      };
    },
    enabled: !!sessionId,
    // Broadcast is primary, but it is exactly the channel that fails silently — poll at the
    // scheduler's own 10s cadence so a missed event costs seconds, not a whole round.
    refetchInterval: 10000,
    // round screen shows a dedicated connection-lost modal.
    meta: { silentError: true },
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

  // Pairings answered in this session, so a remount cannot re-open a prompt already sent.
  const [respondedPairings, setRespondedPairings] = useState<Record<string, string | null>>({});
  const [joinError, setJoinError] = useState(false);
  const [respondError, setRespondError] = useState(false);

  const markJoinedMutation = useMutation({
    mutationFn: (pairingId: string) => apiClient.townSquare.joined(pairingId),
    meta: { invalidates: [queryKeys.matches] },
    onSuccess: () => setJoinError(false),
    onError: () => setJoinError(true),
  });

  const respondMutation = useMutation({
    mutationFn: ({ pairingId, response }: { pairingId: string; response: 'Yes' | 'No' }) =>
      apiClient.townSquare.respond(pairingId, response),
    meta: { invalidates: [queryKeys.matches] },
    onSuccess: (data, variables) => {
      setRespondError(false);
      setRespondedPairings((prev) => ({ ...prev, [variables.pairingId]: data?.matchId ?? null }));
    },
    onError: () => setRespondError(true),
  });

  function submitResponse(pairingId: string, response: 'Yes' | 'No') {
    if (respondMutation.isPending) return;
    setRespondError(false);
    respondMutation.mutate({ pairingId, response });
  }

  const currentPairingId = round?.pairingId ?? '';
  const hasResponded = currentPairingId in respondedPairings;

  return {
    round,
    isLoading,
    error,
    markJoined: (pairingId: string) => markJoinedMutation.mutate(pairingId),
    submitResponse,
    hasResponded,
    matchId: respondedPairings[currentPairingId] ?? null,
    isResponding: respondMutation.isPending,
    respondError,
    clearRespondError: () => setRespondError(false),
    joinError,
    clearJoinError: () => setJoinError(false),
  };
}

export interface TownSquareSessionSummary {
  status: string;
  roundsPlayed: number;
  matches: { matchId: string; otherUserId: string; displayName: string | null }[];
}

/**
 * How a gathering ended, fetched only once the round query has failed. `currentRound` refuses any
 * session that is not InProgress, so a session finishing normally reached the screen as an error
 * and was shown as "you left the square, the session moved on without you" — then dropped the user
 * on a tab that no longer knew the session existed, with the matches they had just made nowhere in
 * sight. This is what tells a normal ending from being dropped, and carries those matches.
 */
export function useTownSquareSessionSummary(sessionId: string | undefined, enabled: boolean) {
  const { data } = useQuery<TownSquareSessionSummary>({
    queryKey: queryKeys.townSquareSessionSummary(sessionId ?? ''),
    queryFn: async () => {
      const res = await apiClient.townSquare.sessionSummary(sessionId!);
      return {
        status: res.status ?? '',
        roundsPlayed: res.roundsPlayed ?? 0,
        matches: (res.matches ?? []).map((m) => ({
          matchId: m.matchId ?? '',
          otherUserId: m.otherUserId ?? '',
          displayName: m.displayName ?? null,
        })),
      };
    },
    enabled: !!sessionId && enabled,
    meta: { silentError: true },
  });
  return data ?? null;
}
