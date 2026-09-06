import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { useAuthStore } from '../store/authStore';

export function useScoreDetail() {
  const session = useAuthStore((s) => s.session);
  return useQuery({
    queryKey: queryKeys.scoreDetail,
    queryFn: () => apiClient.scores.detail(),
    enabled: !!session,
    staleTime: 1000 * 60,
  });
}
