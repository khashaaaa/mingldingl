import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { useAuthStore } from '../store/authStore';

/** Seats at the fire, open scars, districts charted — the character's standing beyond its score. */
export function useStanding() {
  const session = useAuthStore((s) => s.session);
  return useQuery({
    queryKey: queryKeys.standing,
    queryFn: () => apiClient.engagement.standing(),
    enabled: !!session,
    staleTime: 1000 * 60,
    meta: { silentError: true },
  });
}
