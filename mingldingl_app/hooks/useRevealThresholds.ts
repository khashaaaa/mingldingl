import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { useAuthStore } from '../store/authStore';
import { hydrateRevealThresholds, revealLadderSnapshot, subscribeToRevealThresholds } from '../lib/reveal';

export function useRevealThresholds(): void {
  const session = useAuthStore((s) => s.session);
  const { data } = useQuery({
    queryKey: queryKeys.revealThresholds,
    queryFn: () => apiClient.engagement.revealThresholds(),
    enabled: !!session,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (data?.levels) hydrateRevealThresholds(data.levels);
  }, [data]);
}

/**
 * The live ladder, re-rendering the caller when `useRevealThresholds` hydrates it. Pass the result
 * to `nextRevealThreshold`/`deepProfileThreshold` so a screen mounted before the query resolves
 * corrects itself instead of showing the built-in defaults until something else re-renders it.
 */
export function useRevealLadder(): number[] {
  return useSyncExternalStore(subscribeToRevealThresholds, revealLadderSnapshot, revealLadderSnapshot);
}
