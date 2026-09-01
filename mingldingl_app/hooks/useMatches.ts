import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseMatch, type Match } from '../models/match';
import { queryKeys } from '../lib/api/queryKeys';

export function useMatches() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: async (): Promise<Match[]> => {
      const data = await apiClient.matches.list(1);
      return (data.items ?? []).map(parseMatch);
    },
    // matches tab renders its own error state and retry.
    meta: { silentError: true },
  });
}
