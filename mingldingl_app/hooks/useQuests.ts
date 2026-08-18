import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useQuests() {
  const query = useQuery({
    queryKey: queryKeys.questsToday,
    queryFn: apiClient.quests.today,
    staleTime: 1000 * 60,
  });
  const claim = useMutation({
    mutationFn: apiClient.quests.claimChest,
    // scoreHistory invalidation happens in useOptimisticScoreBump —
    // QuestBoard calls bumpScore right after this mutation resolves.
    meta: { invalidates: [queryKeys.quests] },
  });
  return {
    board: query.data,
    isLoading: query.isLoading,
    claimChest: claim.mutateAsync,
    isClaiming: claim.isPending,
  };
}
