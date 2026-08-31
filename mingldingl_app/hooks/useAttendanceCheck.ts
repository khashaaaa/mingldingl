import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useAttendanceCheck(matchId: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.attendanceCheck(matchId),
    queryFn: async () => {
      const res = await apiClient.activities.attendanceCheckStatus(matchId);
      return { due: res.due ?? false, activityTitle: res.activityTitle ?? null };
    },
    enabled: !!matchId,
    staleTime: 1000 * 60,
  });

  const submitMutation = useMutation({
    mutationFn: (attended: boolean) => apiClient.activities.attendanceCheckSubmit(matchId, { attended }),
    onSuccess: () => {
      qc.setQueryData(queryKeys.attendanceCheck(matchId), { due: false, activityTitle: null });
    },
  });

  return {
    due: data?.due ?? false,
    activityTitle: data?.activityTitle ?? null,
    isLoading,
    submit: (attended: boolean) => submitMutation.mutate(attended),
    isSubmitting: submitMutation.isPending,
  };
}
