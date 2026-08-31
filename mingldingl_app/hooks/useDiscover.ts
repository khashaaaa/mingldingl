import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile, type Candidate, type GemTier, type UserProfile } from '../models/user';
import { parseMatch, type Match } from '../models/match';
import type { components } from '../lib/api/api.generated';
import { queryKeys } from '../lib/api/queryKeys';

function parseCandidate(c: components['schemas']['CandidateResponse']): Candidate {
  return {
    ...parseUserProfile({ ...c, photoUrls: c.photoUrls ?? [] }),
    gemTier: (c.gemTier as GemTier) ?? 'Garnet',
  };
}

export function useDiscover() {
  const qc = useQueryClient();

  const {
    data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage,
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
    qc.setQueryData<string[]>(queryKeys.discoverSeen, (current) => [...(current ?? []), id]);
  }

  return {
    candidates, isLoading, isError, error: error as Error | null, refetch,
    markSeen, fetchNextPage, hasNextPage, isFetchingNextPage,
  };
}

export function useRequestMatch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (candidate: UserProfile): Promise<{ matchId: string; awarded: number }> => {
      const data = await apiClient.matches.request(candidate.id);
      return { matchId: data.matchId ?? '', awarded: data.awarded ?? 0 };
    },
    meta: {
      invalidates: [queryKeys.quests, queryKeys.milestones, queryKeys.matches, queryKeys.score],
      awardedSelector: (data) => (data as { awarded: number }).awarded,
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: queryKeys.score });
    },
    onSuccess: ({ matchId, awarded: _awarded }, candidate) => {
      qc.setQueryData<string[]>(queryKeys.discoverSeen, (current) => [...(current ?? []), candidate.id]);

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
