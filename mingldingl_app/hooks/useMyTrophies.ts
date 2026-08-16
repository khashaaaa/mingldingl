import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseTrophy } from '../models/trophy';
import { queryKeys } from '../lib/api/queryKeys';

export function useMyTrophies() {
  return useQuery({
    queryKey: queryKeys.myTrophies,
    queryFn: () => apiClient.activities.mine().then((items) => items.map(parseTrophy)),
    staleTime: 1000 * 60,
  });
}
