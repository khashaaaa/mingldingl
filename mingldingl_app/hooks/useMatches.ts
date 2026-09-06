import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseMatch, type Match } from '../models/match';
import { queryKeys } from '../lib/api/queryKeys';

/** The engine clamps `pageSize` to 50 (`PagingDefaults.MaxPageSize`), so ask for the whole clamp. */
export const MATCH_PAGE_SIZE = 50;

/**
 * A safety stop, not a product limit. Nothing in the app can hold 500 live matches, so hitting the
 * cap means `hasMore` is lying — better to render what we have than to loop on the engine forever.
 */
export const MAX_MATCH_PAGES = 10;

export function useMatches() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: async (): Promise<Match[]> => {
      // Every match detail screen (chat, activities, video) finds its match in this one list, so a
      // single page silently broke each of them past the 20th match — the screen rendered without
      // its reveal strip or rite card, and the quest log simply stopped listing the rest.
      const all: Match[] = [];
      for (let page = 1; page <= MAX_MATCH_PAGES; page++) {
        const data = await apiClient.matches.list(page, MATCH_PAGE_SIZE);
        const items = data.items ?? [];
        all.push(...items.map(parseMatch));
        if (!data.hasMore || items.length === 0) break;
      }
      return all;
    },
    // matches tab renders its own error state and retry.
    meta: { silentError: true },
  });
}
