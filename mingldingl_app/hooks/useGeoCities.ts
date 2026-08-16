import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

// The fixed Mongolia province/district lists, for the fallback picker shown
// when location permission is denied. A static list, effectively never
// changes, so a long staleTime avoids refetching it every time the picker
// opens.
export function useGeoCities() {
  return useQuery({
    queryKey: queryKeys.geoCities,
    queryFn: apiClient.geo.cities,
    staleTime: 1000 * 60 * 60,
  });
}
