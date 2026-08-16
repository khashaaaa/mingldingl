import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useScoreDetail() {
  return useQuery({
    queryKey: queryKeys.scoreDetail,
    queryFn: () => apiClient.scores.detail(),
    staleTime: 1000 * 60,
  });
}
