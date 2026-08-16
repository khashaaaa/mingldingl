import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface ActivitySuggestion {
  id: string;
  activityType: string;
  title: string;
  // Server-derived, straight off the suggestions fetch — not a mutation's
  // local result, so "already pledged" / "both confirmed" / "already rated"
  // survives leaving and returning to this screen instead of resetting to
  // the raw list (and, for rating, re-prompting into a 409 on resubmit).
  myConfirmed: boolean;
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

  const confirm = useMutation({
    mutationFn: (activitySuggestionId: string) =>
      apiClient.activities.confirm(matchId, { activitySuggestionId }),
    // Confirming the date is the single biggest score source in the game
    // (DateConfirmed, +50) once both participants have confirmed — this
    // previously had no score/quest/milestone reflection at all client-side,
    // so it only ever caught up once each cache's own staleTime lapsed.
    // Harmless to invalidate quests/milestones unconditionally: on a confirm
    // that doesn't complete the pair, the board just refetches unchanged.
    meta: {
      invalidates: [queryKeys.quests, queryKeys.milestones],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
    },
    onSuccess: (data, activitySuggestionId) => {
      qc.setQueryData<ActivitySuggestion[]>(queryKeys.activitySuggestions(matchId), (old) =>
        old?.map((s) => (s.id === activitySuggestionId
          ? { ...s, myConfirmed: true, isComplete: data.isComplete ?? false }
          : s)));
    },
  });

  const rate = useMutation({
    mutationFn: ({ businessId, stars, photoUrl }: { businessId: string; stars: number; photoUrl?: string | null }) =>
      apiClient.business.rate(businessId, matchId, { stars, photoUrl }),
    onSuccess: (_data, { businessId }) => {
      // The review just submitted here needs to show up immediately on
      // app/business/[id].tsx, not wait out useBusinessReviews' 5-minute
      // staleTime.
      qc.invalidateQueries({ queryKey: queryKeys.businessReviews(businessId) });
      // Also reflect it in this screen's own "already rated" state without
      // waiting on a refetch of the suggestions list.
      qc.setQueryData<ActivitySuggestion[]>(queryKeys.activitySuggestions(matchId), (old) =>
        old?.map((s) => (s.isComplete ? { ...s, myRated: true } : s)));
    },
  });

  const completed = suggestions?.find((s) => s.isComplete) ?? null;
  // A 409 here means "already rated" raced ahead of this screen's own
  // cached myRated (e.g. rated on another device, or the suggestions list
  // hadn't refetched since) — treat it as the same terminal state rather
  // than the generic failure alert, since retrying can only ever repeat it.
  const rateConflict = isAxiosError(rate.error) && rate.error.response?.status === 409;

  return {
    suggestions,
    isLoading,
    error: error as Error | null,
    confirmDate: confirm.mutate,
    isConfirming: confirm.isPending,
    completed,
    rated: (completed?.myRated ?? false) || rate.isSuccess || rateConflict,
    // photoUrl is the "memorable moment" — optional, shown publicly on the
    // business listing afterward alongside the star rating.
    rateBusiness: (stars: number, photoUrl?: string | null) => {
      if (completed?.business) rate.mutate({ businessId: completed.business.id, stars, photoUrl });
    },
    isRating: rate.isPending,
    rateError: rate.isError && !rateConflict,
  };
}
