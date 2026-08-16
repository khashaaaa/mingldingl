import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseContentPage } from '../models/content';
import { queryKeys } from '../lib/api/queryKeys';

// Static admin-editable content (Terms/Privacy/Guides) — long staleTime
// since it only changes when the (not-yet-built) admin dashboard edits it,
// same reasoning as useMembership's tiers query.
export function useContentPage(slug: string) {
  return useQuery({
    queryKey: queryKeys.contentPage(slug),
    queryFn: async () => parseContentPage(await apiClient.content.get(slug)),
    staleTime: 1000 * 60 * 60,
  });
}
