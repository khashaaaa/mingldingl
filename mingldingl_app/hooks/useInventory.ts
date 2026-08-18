import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';

export function useInventory() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.itemsMine, queryFn: apiClient.items.mine, staleTime: 1000 * 60 });
  const equip = useMutation({
    mutationFn: apiClient.items.equip,
    meta: { invalidates: [queryKeys.items] },
    // Direct write, not covered by meta.invalidates: the response is the
    // full updated user, so reflecting the new frame/title is one parse away
    // instead of waiting on a refetch.
    onSuccess: (user) => qc.setQueryData(queryKeys.userProfile, parseUserProfile(user)),
  });
  return { items: query.data ?? [], isLoading: query.isLoading, equip: equip.mutateAsync, isEquipping: equip.isPending };
}
