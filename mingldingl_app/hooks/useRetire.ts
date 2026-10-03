import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

/** Propose / accept retiring together, and withdraw / decline. */
export function useRetire(matchId: string) {
  const invalidates = [queryKeys.matches, queryKeys.matchStatus(matchId), queryKeys.itemsMine, queryKeys.standing, queryKeys.userProfile];
  const retire = useMutation({
    mutationFn: () => apiClient.matches.retire(matchId),
    meta: { invalidates },
  });
  const withdraw = useMutation({
    mutationFn: () => apiClient.matches.withdrawRetire(matchId),
    meta: { invalidates },
  });
  return { retire, withdraw };
}
