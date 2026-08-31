import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile, type Oath } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';

export function useSwearOath() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (oath: Oath) => apiClient.users.swearOath(oath),
    onSuccess: (data) => qc.setQueryData(queryKeys.userProfile, parseUserProfile(data)),
  });

  return {
    swear: (oath: Oath) => mutation.mutate(oath),
    isSwearing: mutation.isPending,
    swearError: mutation.isError,
  };
}
