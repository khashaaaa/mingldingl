import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { parsePendingShip } from '../models/ship';

export function usePendingShips() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.pendingShips,
    queryFn: async () => (await apiClient.ships.pending()).map(parsePendingShip),
  });

  const respond = useMutation({
    mutationFn: ({ shipId, accept }: { shipId: string; accept: boolean }) =>
      apiClient.ships.respond(shipId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingShips });
      // An accept can spark a brand-new Match server-side (RespondToShipResponse.sparked) —
      // invalidate unconditionally rather than branching on that flag, since a
      // stale matches list is cheap to refetch and the alternative (skipping
      // it on every non-sparking response) is a second place this could drift.
      queryClient.invalidateQueries({ queryKey: queryKeys.matches });
    },
  });

  return { pendingShips: query.data ?? [], respond: respond.mutate };
}
