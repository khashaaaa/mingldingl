import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { parsePendingShip } from '../models/ship';

export function usePendingShips() {
  const query = useQuery({
    queryKey: queryKeys.pendingShips,
    queryFn: async () => (await apiClient.ships.pending()).map(parsePendingShip),
  });

  const respond = useMutation({
    mutationFn: ({ shipId, accept }: { shipId: string; accept: boolean }) =>
      apiClient.ships.respond(shipId, accept),
    meta: { invalidates: [queryKeys.pendingShips, queryKeys.matches] },
  });

  return { pendingShips: query.data ?? [], respond: respond.mutate };
}
