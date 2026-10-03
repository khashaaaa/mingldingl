import { useMutation, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export type TrialKind = 'exchange' | 'rite';

/**
 * This week's shared trial for a match. A 404 means trials are switched off (or the match has
 * ended) — an absent feature, not a failure, so the strip simply does not draw.
 */
export function useBondTrial(matchId: string, enabled = true) {
  const { data, error } = useQuery({
    queryKey: queryKeys.trial(matchId),
    queryFn: () => apiClient.matches.trial(matchId),
    enabled: !!matchId && enabled,
    staleTime: 1000 * 30,
    meta: { silentError: true },
  });
  const unavailable = isAxiosError(error) && error.response?.status === 404;

  const claim = useMutation({
    mutationFn: () => apiClient.matches.claimTrial(matchId),
    meta: {
      invalidates: [queryKeys.trial(matchId), queryKeys.scoreDetail, queryKeys.score],
      awardedSelector: (d) => (d as { reward?: number }).reward,
    },
  });

  return {
    trial: unavailable ? null : data ?? null,
    claim: claim.mutate,
    isClaiming: claim.isPending,
    claimError: claim.error,
  };
}
