import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

interface HistoryPageParam {
  cursor?: string;
  cursorId?: string;
}

export function useScoreHistory() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.scoreHistory,
    queryFn: ({ pageParam }: { pageParam: HistoryPageParam }) =>
      apiClient.scores.history(pageParam.cursor, pageParam.cursorId),
    initialPageParam: {} as HistoryPageParam,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor && lastPage.nextCursorId
        ? { cursor: lastPage.nextCursor, cursorId: lastPage.nextCursorId }
        : undefined,
    staleTime: 1000 * 60,
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((p) => p.items ?? []),
  };
}
