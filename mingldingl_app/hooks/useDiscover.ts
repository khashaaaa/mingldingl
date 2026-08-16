import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile, type UserProfile } from '../models/user';
import { parseMatch, type Match } from '../models/match';
import type { components } from '../lib/api/api.generated';
import { queryKeys } from '../lib/api/queryKeys';

function parseCandidate(c: components['schemas']['CandidateResponse']): UserProfile {
  return parseUserProfile({ ...c, photoUrls: c.photoUrls ?? [] });
}

export function useDiscover() {
  const qc = useQueryClient();

  const {
    data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.discover,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.matches.candidates(pageParam);
      return {
        items: (res.items ?? []).map(parseCandidate),
        page: res.page ?? pageParam,
        hasMore: res.hasMore ?? false,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 1000 * 60 * 5,
  });
  // Both re-derived here instead of inline: this hook re-renders on every
  // unrelated cache change that touches queryKeys.discover's observers (a
  // score bump, a tier-up, anything sharing this component tree), and a long
  // swiping session accumulates every fetched page into `data` with no
  // eviction — re-flattening/re-filtering that whole growing list from
  // scratch on renders that didn't actually change it was pure waste.
  const allCandidates = useMemo(() => data?.pages.flatMap((p) => p.items), [data]);

  const { data: seenIds = [] } = useQuery<string[]>({
    queryKey: queryKeys.discoverSeen,
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const candidates = useMemo(() => {
    const seenSet = new Set(seenIds);
    return allCandidates?.filter((c) => !seenSet.has(c.id));
  }, [allCandidates, seenIds]);

  function markSeen(id: string) {
    const current = qc.getQueryData<string[]>(queryKeys.discoverSeen) ?? [];
    qc.setQueryData<string[]>(queryKeys.discoverSeen, [...current, id]);
  }

  return { candidates, isLoading, markSeen, fetchNextPage, hasNextPage, isFetchingNextPage };
}

export function useRequestMatch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (candidate: UserProfile): Promise<{ matchId: string; awarded: number }> => {
      const data = await apiClient.matches.request(candidate.id);
      return { matchId: data.matchId ?? '', awarded: data.awarded ?? 0 };
    },
    // Sending a summons has no guaranteed base score of its own — awarded
    // is only nonzero when today's rotated daily quest is "Send a Summons"
    // and this is the first one — and it always calls MilestoneService.
    // AchieveAsync ("first_match") + QuestService.IncrementAsync ("summons")
    // on the engine regardless, so quests/milestones must refresh either way.
    meta: {
      invalidates: [queryKeys.quests, queryKeys.milestones],
      awardedSelector: (data) => (data as { awarded: number }).awarded,
    },
    onSuccess: ({ matchId, awarded: _awarded }, candidate) => {
      const current = qc.getQueryData<string[]>(queryKeys.discoverSeen) ?? [];
      qc.setQueryData<string[]>(queryKeys.discoverSeen, [...current, candidate.id]);

      const newMatch: Match = parseMatch({
        matchId,
        otherUserId: candidate.id,
        status: 'Active',
        revealLevel: 0,
        messageCount: 0,
        icebreakerComplete: false,
        videoCallUnlocked: false,
        otherUser: {
          displayName: candidate.displayName,
          firstPhoto: (candidate.photoUrls ?? [])[0],
          bio: candidate.bio,
          age: candidate.age,
          district: candidate.city,
        },
      });
      qc.setQueryData<Match[]>(queryKeys.matches, (old) => [...(old ?? []), newMatch]);
    },
  });
}
