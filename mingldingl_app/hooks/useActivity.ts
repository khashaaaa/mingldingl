import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseBusiness } from '../models/business';
import { queryKeys } from '../lib/api/queryKeys';

export function useActivity() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.activity,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.business.list({ page: pageParam });
      return {
        items: (res.items ?? []).map(parseBusiness),
        page: res.page ?? pageParam,
        hasMore: res.hasMore ?? false,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((p) => p.items),
  };
}
