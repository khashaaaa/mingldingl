import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';

export function useInventory() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.itemsMine, queryFn: apiClient.items.mine, staleTime: 1000 * 60 });
  const equip = useMutation({
    mutationFn: apiClient.items.equip,
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.userProfile, parseUserProfile(user));
      qc.invalidateQueries({ queryKey: queryKeys.items });
    },
  });
  return { items: query.data ?? [], isLoading: query.isLoading, equip: equip.mutateAsync, isEquipping: equip.isPending };
}
