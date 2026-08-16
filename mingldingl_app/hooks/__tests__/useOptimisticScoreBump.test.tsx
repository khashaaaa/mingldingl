import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { useOptimisticScoreBump } from '../useOptimisticScoreBump';
import { queryKeys } from '../../lib/api/queryKeys';
import { useAuthStore } from '../../store/authStore';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
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

describe('useOptimisticScoreBump', () => {
  beforeEach(() => {
    useAuthStore.setState({ pendingTierUp: null });
  });

  it('bumps totalScore without crossing a tier boundary and does not set pendingTierUp', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 50 });
    const { result } = renderHook(() => useOptimisticScoreBump(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current(5); });

    const updated = queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail;
    expect(updated.totalScore).toBe(55);
    expect(updated.gemTier).toBe('Garnet');
    expect(useAuthStore.getState().pendingTierUp).toBeNull();
  });

  it('bumps totalScore across a tier boundary and sets pendingTierUp to the new tier', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 90, gemTier: 'Garnet' });
    const { result } = renderHook(() => useOptimisticScoreBump(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current(15); }); // 90 + 15 = 105, crosses the Garnet->Opal boundary at 100

    const updated = queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail;
    expect(updated.totalScore).toBe(105);
    expect(updated.gemTier).toBe('Opal');
    expect(useAuthStore.getState().pendingTierUp).toBe('Opal');
  });

  it('does nothing when there is no cached scoreDetail yet', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOptimisticScoreBump(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current(20); });

    expect(queryClient.getQueryData(queryKeys.scoreDetail)).toBeUndefined();
    expect(useAuthStore.getState().pendingTierUp).toBeNull();
  });

  it('invalidates scoreHistory so the Progression screen\'s itemized list picks up the new entry', () => {
    // Every caller here just awarded a real server-side ScoreEvent — without
    // this, the history list lags behind its own 60s staleTime or a remount.
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.scoreDetail, { ...baseScoreDetail, totalScore: 50 });
    queryClient.setQueryData(queryKeys.scoreHistory, { pages: [], pageParams: [] });
    const { result } = renderHook(() => useOptimisticScoreBump(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current(5); });

    expect(queryClient.getQueryState(queryKeys.scoreHistory)?.isInvalidated).toBe(true);
  });
});
