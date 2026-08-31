import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useGeoCities() {
  return useQuery({
    queryKey: queryKeys.geoCities,
    queryFn: apiClient.geo.cities,
    staleTime: 1000 * 60 * 60,
  });
}
