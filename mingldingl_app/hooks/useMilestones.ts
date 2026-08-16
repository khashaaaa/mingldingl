import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useMilestones() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.milestones, queryFn: apiClient.milestones.list, staleTime: 1000 * 60 });
  const open = useMutation({
    mutationFn: apiClient.milestones.open,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.milestones });
      qc.invalidateQueries({ queryKey: queryKeys.items });
      // scoreHistory invalidation happens in useOptimisticScoreBump —
      // TrophyCase calls bumpScore right after this mutation resolves.
    },
  });
  return { milestones: query.data ?? [], isLoading: query.isLoading, open: open.mutateAsync, isOpening: open.isPending };
}
