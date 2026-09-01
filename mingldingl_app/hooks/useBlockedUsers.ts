import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseBlockedUser } from '../models/blockedUser';
import { queryKeys } from '../lib/api/queryKeys';

export function useBlockedUsers() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: () => apiClient.users.blockedUsers().then((items) => items.map(parseBlockedUser)),
    // blocked-users screen renders its own error state and retry.
    meta: { silentError: true },
  });

  const unblock = useMutation({
    mutationFn: (targetUserId: string) => apiClient.users.unblock(targetUserId),
    onSuccess: (data) => qc.setQueryData(queryKeys.blockedUsers, data.map(parseBlockedUser)),
  });

  return {
    blockedUsers: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    unblock: unblock.mutate,
    unblockingUserId: unblock.isPending ? (unblock.variables ?? null) : null,
  };
}
