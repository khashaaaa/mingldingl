import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { session } from './session';

/**
 * Same rules as the app: data changes only when a live event says so (lib/live) — no stale timer,
 * no refetch on focus or reconnect, no polling. Unused data leaves memory after 5 minutes.
 * `refetchOnMount` stays on: with an infinite staleTime only an invalidated query is stale, and an
 * event for a page that is not open is otherwise lost when that page is opened.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
      retry: (count, e) => count < 1 && !(e instanceof ApiError && e.status > 0 && e.status < 500),
    },
    mutations: { retry: false },
  },
});

session.subscribe(() => {
  if (!session.get()) queryClient.clear();
});
