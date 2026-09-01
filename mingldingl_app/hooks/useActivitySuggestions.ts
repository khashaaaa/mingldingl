import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface ActivitySuggestion {
  id: string;
  activityType: string;
  title: string;

  myConfirmed: boolean;
  partnerConfirmed: boolean | null;
  isComplete: boolean;
  myRated: boolean;
  business: {
    id: string;
    name: string;
    averageRating: number;
    district: string;
    photo: string | null;
  } | null;
}

export function useActivitySuggestions(matchId: string) {
  const qc = useQueryClient();

  const { data: suggestions, isLoading, error } = useQuery<ActivitySuggestion[]>({
    queryKey: queryKeys.activitySuggestions(matchId),
    queryFn: async () => {
      const res = await apiClient.activities.suggestions(matchId);
      return res.map((s) => ({
        id: s.id ?? '',
        activityType: s.activityType ?? '',
        title: s.title ?? '',
        myConfirmed: s.myConfirmed ?? false,
        partnerConfirmed: s.isComplete ? true : null,
        isComplete: s.isComplete ?? false,
        myRated: s.myRated ?? false,
        business: s.business
          ? {
              id: s.business.id ?? '',
              name: s.business.name ?? '',
              averageRating: s.business.averageRating ?? 0,
              district: s.business.district ?? '',
              photo: s.business.photo ?? null,
            }
          : null,
      }));
    },
    enabled: !!matchId,
  });

  const { data: partnerPledged = false } = useQuery<boolean>({
    queryKey: queryKeys.partnerPledged(matchId),
    queryFn: () => false,
    initialData: false,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!matchId,
  });

  const confirm = useMutation({
    mutationFn: (activitySuggestionId: string) =>
      apiClient.activities.confirm(matchId, { activitySuggestionId }),
    meta: {
      invalidates: [queryKeys.quests, queryKeys.milestones, queryKeys.campaignAll],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
    },
    onSuccess: (data, activitySuggestionId) => {
      const isComplete = data.isComplete ?? false;
      const partnerConfirmed = (data.initiatorConfirmed ?? false) && (data.receiverConfirmed ?? false);
      qc.setQueryData<ActivitySuggestion[]>(queryKeys.activitySuggestions(matchId), (old) =>
        old?.map((s) => (s.id === activitySuggestionId
          ? { ...s, myConfirmed: true, partnerConfirmed, isComplete }
          : s)));
      if (isComplete) qc.setQueryData(queryKeys.partnerPledged(matchId), false);
    },
  });

  const rate = useMutation({
    mutationFn: ({ businessId, stars, photoUrl }: {
      suggestionId: string; businessId: string; stars: number; photoUrl?: string | null;
    }) =>
      apiClient.business.rate(businessId, matchId, { stars, photoUrl }),
    meta: { invalidates: [queryKeys.myTrophies, queryKeys.activity] },
    onSuccess: (_data, { businessId, suggestionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.businessReviews(businessId) });

      qc.setQueryData<ActivitySuggestion[]>(queryKeys.activitySuggestions(matchId), (old) =>
        old?.map((s) => (s.id === suggestionId ? { ...s, myRated: true } : s)));
    },
  });

  const completed = suggestions?.find((s) => s.isComplete) ?? null;

  const rateConflict = isAxiosError(rate.error) && rate.error.response?.status === 409;

  return {
    suggestions,
    partnerPledged,
    isLoading,
    error: error as Error | null,
    confirmDate: confirm.mutate,
    isConfirming: confirm.isPending,
    // Which suggestion is in flight, so one pledge does not spin every card's button.
    confirmingId: confirm.isPending ? confirm.variables ?? null : null,
    completed,
    rated: (completed?.myRated ?? false) || rate.isSuccess || rateConflict,
    rateBusiness: (stars: number, photoUrl?: string | null) => {
      if (completed?.business) {
        rate.mutate({ suggestionId: completed.id, businessId: completed.business.id, stars, photoUrl });
      }
    },
    isRating: rate.isPending,
    rateError: rate.isError && !rateConflict,
  };
}
