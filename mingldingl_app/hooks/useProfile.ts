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
