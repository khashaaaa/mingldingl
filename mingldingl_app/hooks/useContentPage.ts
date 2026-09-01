import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseContentPage } from '../models/content';
import { queryKeys } from '../lib/api/queryKeys';

export function useContentPage(slug: string) {
  return useQuery({
    queryKey: queryKeys.contentPage(slug),
    queryFn: async () => parseContentPage(await apiClient.content.get(slug)),
    staleTime: 1000 * 60 * 60,
    // content screen renders its own error state and retry.
    meta: { silentError: true },
  });
}
