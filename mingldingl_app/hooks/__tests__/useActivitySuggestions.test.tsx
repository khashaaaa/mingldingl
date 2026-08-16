import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useActivitySuggestions } from '../useActivitySuggestions';
import { apiClient } from '../../lib/api/apiClient';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    activities: {
      suggestions: jest.fn(),
      confirm: jest.fn(),
    },
    business: {
      rate: jest.fn(),
    },
  },
}));

const mockApi = apiClient as unknown as {
  activities: {
    suggestions: jest.Mock;
    confirm: jest.Mock;
  };
  business: {
    rate: jest.Mock;
  };
};

function makeQueryClient() {
  return createAppQueryClient({
    queries: { retry: false },
    mutations: { retry: false },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const suggestion = (overrides: Partial<any> = {}) => ({
  id: 's1',
  activityType: 'coffee',
  title: 'Grab coffee',
  myConfirmed: false,
  isComplete: false,
  business: {
    id: 'biz1',
    name: 'Corner Cafe',
    averageRating: 4.5,
    district: 'Downtown',
    photo: null,
  },
  ...overrides,
});

describe('useActivitySuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('confirm: local cache merge', () => {
    it('marks only the confirmed suggestion as myConfirmed and sets isComplete from the response', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1' }), suggestion({ id: 's2' })]);
      mockApi.activities.confirm.mockResolvedValue({ isComplete: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(2));

      await act(async () => {
        result.current.confirmDate('s1');
      });

      await waitFor(() => {
        const s1 = result.current.suggestions?.find((s) => s.id === 's1');
        expect(s1?.myConfirmed).toBe(true);
      });

      const s1 = result.current.suggestions?.find((s) => s.id === 's1');
      const s2 = result.current.suggestions?.find((s) => s.id === 's2');
      expect(s1?.isComplete).toBe(true);
      // The other suggestion in the list must be untouched by the merge.
      expect(s2?.myConfirmed).toBe(false);
      expect(s2?.isComplete).toBe(false);
    });

    it('defaults isComplete to false when the confirm response omits it', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1' })]);
      mockApi.activities.confirm.mockResolvedValue({});

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

      await act(async () => {
        result.current.confirmDate('s1');
      });

      await waitFor(() => expect(result.current.suggestions?.[0].myConfirmed).toBe(true));
      expect(result.current.suggestions?.[0].isComplete).toBe(false);
    });

    it('leaves the cache untouched if confirm resolves for an id no longer in the list', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1' })]);
      mockApi.activities.confirm.mockResolvedValue({ isComplete: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

      await act(async () => {
        result.current.confirmDate('does-not-exist');
      });

      await waitFor(() => expect(result.current.isConfirming).toBe(false));
      expect(result.current.suggestions?.[0].myConfirmed).toBe(false);
    });
  });

  describe('confirm: score/quest/milestone reflection', () => {
    const baseScoreDetail = {
      totalScore: 50, gemTier: 'Garnet', reputationScore: 1, currentStreak: 0, longestStreak: 0,
      tierIndex: 0, tierBonus: 0, nextTier: 'Opal', nextTierThreshold: 100, progressPct: 50,
      dailyMatchBudget: 5,
    };

    it('bumps the score and refreshes quests/milestones when the confirm completes the pair', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1' })]);
      mockApi.activities.confirm.mockResolvedValue({ isComplete: true, awarded: 50 });

      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
      await act(async () => { result.current.confirmDate('s1'); });
      await waitFor(() => expect(result.current.suggestions?.[0].myConfirmed).toBe(true));

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(100);
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.quests }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.milestones }));
    });

    it('does not bump the score when the confirm does not yet complete the pair (awarded: 0)', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1' })]);
      mockApi.activities.confirm.mockResolvedValue({ isComplete: false, awarded: 0 });

      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
      await act(async () => { result.current.confirmDate('s1'); });
      await waitFor(() => expect(result.current.suggestions?.[0].myConfirmed).toBe(true));

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(50);
    });
  });

  describe('completed / rateBusiness gating', () => {
    it('exposes the first isComplete suggestion as `completed`, or null when none is complete', async () => {
      mockApi.activities.suggestions.mockResolvedValue([
        suggestion({ id: 's1', isComplete: false }),
        suggestion({ id: 's2', isComplete: true }),
      ]);

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.completed).not.toBeNull());
      expect(result.current.completed?.id).toBe('s2');
    });

    it('completed is null and rateBusiness is a no-op when nothing is complete', async () => {
      mockApi.activities.suggestions.mockResolvedValue([suggestion({ id: 's1', isComplete: false })]);

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
      expect(result.current.completed).toBeNull();

      act(() => {
        result.current.rateBusiness(5);
      });

      expect(mockApi.business.rate).not.toHaveBeenCalled();
    });

    it('does not call business.rate when the completed suggestion has no business', async () => {
      mockApi.activities.suggestions.mockResolvedValue([
        suggestion({ id: 's1', isComplete: true, business: null }),
      ]);

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.completed).not.toBeNull());

      act(() => {
        result.current.rateBusiness(5);
      });

      expect(mockApi.business.rate).not.toHaveBeenCalled();
    });

    it('calls business.rate with the completed suggestion business id, matchId, stars and photoUrl when complete', async () => {
      mockApi.activities.suggestions.mockResolvedValue([
        suggestion({ id: 's1', isComplete: true, business: { id: 'biz1', name: 'Cafe', averageRating: 4, district: 'D', photo: null } }),
      ]);
      mockApi.business.rate.mockResolvedValue({});

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.completed).not.toBeNull());

      act(() => {
        result.current.rateBusiness(5, 'https://photo.example/pic.jpg');
      });

      await waitFor(() => expect(result.current.rated).toBe(true));
      expect(mockApi.business.rate).toHaveBeenCalledWith('biz1', 'm1', { stars: 5, photoUrl: 'https://photo.example/pic.jpg' });
    });
  });

  describe('rate mutation success/error', () => {
    it('invalidates the businessReviews query for the rated business on success', async () => {
      mockApi.activities.suggestions.mockResolvedValue([
        suggestion({ id: 's1', isComplete: true, business: { id: 'biz1', name: 'Cafe', averageRating: 4, district: 'D', photo: null } }),
      ]);
      mockApi.business.rate.mockResolvedValue({});

      const queryClient = makeQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.completed).not.toBeNull());

      act(() => {
        result.current.rateBusiness(4);
      });

      await waitFor(() => expect(result.current.rated).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.businessReviews('biz1') }),
      );
    });

    it('sets rateError and leaves rated false when business.rate rejects', async () => {
      mockApi.activities.suggestions.mockResolvedValue([
        suggestion({ id: 's1', isComplete: true, business: { id: 'biz1', name: 'Cafe', averageRating: 4, district: 'D', photo: null } }),
      ]);
      mockApi.business.rate.mockRejectedValue(new Error('server exploded'));

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useActivitySuggestions('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.completed).not.toBeNull());

      act(() => {
        result.current.rateBusiness(1);
      });

      await waitFor(() => expect(result.current.rateError).toBe(true));
      expect(result.current.rated).toBe(false);
    });
  });
});
