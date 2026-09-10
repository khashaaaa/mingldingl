import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

/**
 * Calls off a pending account deletion. Its own hook because two screens offer it — Settings, and
 * the banner on the character sheet — and because cancelling is now a deliberate act: the engine
 * stopped clearing the request on `GET /users/me`, so nothing does it by accident any more.
 */
export function useCancelDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.users.cancelDeletion(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.userProfile }),
  });
}
