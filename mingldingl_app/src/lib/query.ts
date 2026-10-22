import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { getGetMeQueryKey } from './api/generated/engine';
import { onRefreshedMe, onSignedOut } from './session';

/**
 * Data changes only when a live event says so (lib/live): no stale timer, no refetch on focus or
 * reconnect, no polling. Unused data leaves memory after 5 minutes; nothing is persisted to disk.
 * `refetchOnMount` stays on: with an infinite staleTime only an invalidated query is stale, and an
 * event that lands while no screen watches its query is otherwise lost when that screen returns.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
      retry: (count, e) =>
        count < 1 && !(e instanceof ApiError && (e.kind === 'rule' || e.kind === 'signed-out')),
    },
    mutations: { retry: false },
  },
});

onSignedOut(() => queryClient.clear());
// Seeds /me only when nothing holds it yet (the launch): a later refresh must not overwrite a
// newer answer a screen wrote, and live events keep it current from there.
onRefreshedMe((me) => {
  if (queryClient.getQueryData(getGetMeQueryKey()) === undefined)
    queryClient.setQueryData(getGetMeQueryKey(), me);
});
