import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useMilestones() {
  const query = useQuery({ queryKey: queryKeys.milestones, queryFn: apiClient.milestones.list, staleTime: 1000 * 60 });
  const open = useMutation({
    mutationFn: apiClient.milestones.open,
    meta: { invalidates: [queryKeys.milestones, queryKeys.items], silentError: true },
  });
  return { milestones: query.data ?? [], isLoading: query.isLoading, open: open.mutateAsync, isOpening: open.isPending };
}
