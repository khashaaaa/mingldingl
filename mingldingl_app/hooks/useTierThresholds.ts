import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { useAuthStore } from '../store/authStore';
import { hydrateTierThresholds } from '../lib/tiers';

// Fetched once at app boot (see app/_layout.tsx) and used to hydrate
// lib/tiers.ts's module-level thresholds — see that file for why this
// replaced a hand-maintained client-side copy of the engine's tier table.
// Static reference data, so a long staleTime like useMembership's tiers().
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
