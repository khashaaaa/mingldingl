import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDiscover, useRequestMatch } from '../useDiscover';
import { apiClient } from '../../lib/api/apiClient';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { useAuthStore } from '../../store/authStore';
import type { Match } from '../../models/match';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    matches: {
      candidates: jest.fn(),
      request: jest.fn(),
    },
  },
}));

const mockCandidates = apiClient.matches.candidates as jest.Mock;
const mockRequest = apiClient.matches.request as jest.Mock;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function candidate(id: string, displayName = `User ${id}`) {
  return { id, displayName, photoUrls: [`${id}.jpg`] };
}

const baseScoreDetail = {
  totalScore: 90,
  gemTier: 'Garnet',
  reputationScore: 1,
  currentStreak: 0,
  longestStreak: 0,
  tierIndex: 0,
  tierBonus: 0,
  nextTier: 'Opal',
  nextTierThreshold: 100,
  progressPct: 90,
  dailyMatchBudget: 5,
};

describe('useDiscover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingTierUp: null });
  });

  it('excludes candidates already marked seen, and includes unseen ones', async () => {
    mockCandidates.mockResolvedValue({
      items: [candidate('c1'), candidate('c2'), candidate('c3')],
      page: 1,
      hasMore: false,
    });
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, ['c2']);
    const { result } = renderHook(() => useDiscover(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ids = result.current.candidates?.map((c) => c.id);
    expect(ids).toEqual(['c1', 'c3']);
  });

  it('re-filters against the seen set once markSeen is called', async () => {
    mockCandidates.mockResolvedValue({
      items: [candidate('c1'), candidate('c2')],
      page: 1,
      hasMore: false,
    });
    const queryClient = createAppQueryClient();
    const { result } = renderHook(() => useDiscover(), { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.candidates?.map((c) => c.id)).toEqual(['c1', 'c2']);

    act(() => { result.current.markSeen('c1'); });

    // markSeen's qc.setQueryData() applies synchronously, but the observer
    // notification that flows it into `result.current` goes through
    // TanStack Query's notifyManager, which schedules via a real
    // setTimeout(0) rather than notifying synchronously — so the re-render
    // lands one real tick after act() returns. waitFor polls across that.
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.discoverSeen)).toEqual(['c1']));
    await waitFor(() => expect(result.current.candidates?.map((c) => c.id)).toEqual(['c2']));
  });

  it('filters the seen set across multiple paginated pages after fetchNextPage', async () => {
    mockCandidates.mockImplementation((page: number) => {
      if (page === 1) {
        return Promise.resolve({ items: [candidate('c1'), candidate('c2')], page: 1, hasMore: true });
      }
      return Promise.resolve({ items: [candidate('c3'), candidate('c4')], page: 2, hasMore: false });
    });
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, ['c2', 'c3']);
    const { result } = renderHook(() => useDiscover(), { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.candidates?.map((c) => c.id)).toEqual(['c1']);

    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

    // c2 and c3 stay excluded across both pages; c1 and c4 (unseen, from
    // different pages) are both present, proving the seen-filter runs on the
    // flattened cross-page list rather than being reset per page.
    await waitFor(() => expect(result.current.candidates?.map((c) => c.id)).toEqual(['c1', 'c4']));
  });
});

describe('useRequestMatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingTierUp: null });
  });

  it('on success: marks the candidate seen, inserts an optimistic match, and bumps the score by the server-reported award', async () => {
    // awarded: 15 here models the day's rotated quest being "Send a
    // Summons" and this being the first one — sending a summons has no
    // guaranteed base score of its own, so the bump must come from what the
    // server actually reports, not a hardcoded constant.
    mockRequest.mockResolvedValue({ matchId: 'new-match-1', awarded: 15 });
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, []);
    queryClient.setQueryData(queryKeys.matches, [] as Match[]);
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 50 });
    const { result } = renderHook(() => useRequestMatch(), { wrapper: makeWrapper(queryClient) });

    const target = candidate('cX', 'Jamie');
    await act(async () => {
      await result.current.mutateAsync(target as any);
    });

    expect(queryClient.getQueryData(queryKeys.discoverSeen)).toEqual(['cX']);

    const matches = queryClient.getQueryData<Match[]>(queryKeys.matches);
    expect(matches).toHaveLength(1);
    expect(matches?.[0]).toMatchObject({
      matchId: 'new-match-1',
      otherUserId: 'cX',
      status: 'Active',
      otherUser: { displayName: 'Jamie' },
    });

    const scoreDetail = queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail;
    expect(scoreDetail.totalScore).toBe(65); // +15 from the server-reported award
  });

  it('on success with no award (no quest completed): does not bump the score', async () => {
    // Sending a summons on a day when "Send a Summons" isn't in today's
    // rotated quests (or it's already complete) awards nothing — the client
    // must not assume a fixed +15 regardless of what the server reports.
    mockRequest.mockResolvedValue({ matchId: 'new-match-3', awarded: 0 });
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, []);
    queryClient.setQueryData(queryKeys.matches, [] as Match[]);
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 50 });
    const { result } = renderHook(() => useRequestMatch(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync(candidate('cW') as any);
    });

    const scoreDetail = queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail;
    expect(scoreDetail.totalScore).toBe(50);
  });

  it('appends to existing seen/matches caches rather than clobbering them', async () => {
    mockRequest.mockResolvedValue({ matchId: 'new-match-2' });
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, ['already-seen']);
    queryClient.setQueryData(queryKeys.matches, [
      { matchId: 'existing', otherUserId: 'u0' } as Match,
    ]);
    const { result } = renderHook(() => useRequestMatch(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync(candidate('cY') as any);
    });

    expect(queryClient.getQueryData(queryKeys.discoverSeen)).toEqual(['already-seen', 'cY']);
    const matches = queryClient.getQueryData<Match[]>(queryKeys.matches);
    expect(matches).toHaveLength(2);
    expect(matches?.[0].matchId).toBe('existing');
    expect(matches?.[1].matchId).toBe('new-match-2');
  });

  it('does not touch the seen/matches/score caches when the request fails', async () => {
    mockRequest.mockRejectedValue(new Error('network down'));
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.discoverSeen, []);
    queryClient.setQueryData(queryKeys.matches, [] as Match[]);
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 50 });
    const { result } = renderHook(() => useRequestMatch(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await expect(result.current.mutateAsync(candidate('cZ') as any)).rejects.toThrow('network down');
    });

    expect(queryClient.getQueryData(queryKeys.discoverSeen)).toEqual([]);
    expect(queryClient.getQueryData(queryKeys.matches)).toEqual([]);
    const scoreDetail = queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail;
    expect(scoreDetail.totalScore).toBe(50);
  });
});
