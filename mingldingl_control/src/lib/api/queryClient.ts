import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient: QueryClient = new QueryClient({
  // Every admin write is audited by the engine, so any successful mutation makes the log stale.
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: (failureCount, error) => {
        if (isAxiosError(error)) {
          const status = error.response?.status;
          if (status !== undefined && status >= 400 && status < 500) return false;
        }
        return failureCount < 1;
      },
    },
  },
});
