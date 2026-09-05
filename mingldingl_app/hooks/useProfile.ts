import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import type { components } from '../lib/api/api.generated';
import { parseUserProfile, type UserProfile } from '../models/user';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../lib/api/queryKeys';

export function useProfile() {
  const session = useAuthStore((s) => s.session);
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: async () => {
      try {
        return await apiClient.users.me().then(parseUserProfile);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!session,
    staleTime: 1000 * 60,
  });
}

export type ProfilePatch = components['schemas']['UpdateUserRequest'];

/**
 * The single `PUT /users/me` path. Every caller used to hand-roll the request plus the
 * `setQueryData(userProfile)` write; keeping it here means the cache key, the parse and the
 * rollback live in one place.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (patch: ProfilePatch) => apiClient.users.update(patch),
    onSuccess: (data) => qc.setQueryData(queryKeys.userProfile, parseUserProfile(data)),
  });

  /**
   * Show a change before the request that makes it real, and hand back its exact undo. A save that
   * spans more than its own request — the avatar has to finish uploading first — needs the preview
   * up front, so it cannot ride on the mutation's `onMutate`.
   *
   * The patch is typed as the parsed model rather than the request DTO on purpose: the cache holds
   * `parseUserProfile` output, whose fields are non-null, and a raw DTO field would write a `null`
   * into a slot every reader trusts.
   */
  function previewPatch(patch: Partial<UserProfile>): () => void {
    const previous = qc.getQueryData<UserProfile>(queryKeys.userProfile);
    if (previous) qc.setQueryData<UserProfile>(queryKeys.userProfile, { ...previous, ...patch });
    return () => {
      if (previous) qc.setQueryData(queryKeys.userProfile, previous);
    };
  }

  return {
    mutateAsync: (patch: ProfilePatch) => mutation.mutateAsync(patch).then(parseUserProfile),
    previewPatch,
    isPending: mutation.isPending,
  };
}
