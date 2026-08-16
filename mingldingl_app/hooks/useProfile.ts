import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../lib/api/queryKeys';

export function useProfile() {
  const session = useAuthStore((s) => s.session);
  return useQuery({
    queryKey: queryKeys.userProfile,
    // A 404 here is the engine's genuine "no profile yet" signal (see
    // UsersController.GetMe) — resolve to null so callers can route to
    // onboarding. Any other failure (network blip, 5xx) rethrows so
    // isError distinguishes "confirmed no profile" from "couldn't tell yet",
    // which matters because app/_layout.tsx routes `!userProfile` straight
    // into onboarding, and re-onboarding overwrites an existing profile.
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
