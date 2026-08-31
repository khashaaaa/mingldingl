import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { useAuthStore } from '../store/authStore';
import { hydrateTierThresholds } from '../lib/tiers';

export function useTierThresholds(): void {
  const session = useAuthStore((s) => s.session);
  const { data } = useQuery({
    queryKey: queryKeys.tierThresholds,
    queryFn: () => apiClient.scores.tiers(),
    enabled: !!session,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (data?.tiers) hydrateTierThresholds(data.tiers);
  }, [data]);
}
