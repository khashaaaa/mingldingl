import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useDailyMatchBudget } from '../useScore';
import { apiClient } from '../../lib/api/apiClient';
import { createAppQueryClient } from '../../lib/api/queryClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { scores: { me: jest.fn() } },
}));

const mockMe = apiClient.scores.me as jest.Mock;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDailyMatchBudget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is null until /scores/me resolves', () => {
    mockMe.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDailyMatchBudget(), { wrapper: makeWrapper(createAppQueryClient()) });
    expect(result.current).toBeNull();
  });

  it('maps the budget counters from the score response', async () => {
    mockMe.mockResolvedValue({ totalScore: 10, gemTier: 'Garnet', dailyMatchBudget: 5, dailyMatchesUsed: 2, dailyMatchesRemaining: 3 });
    const { result } = renderHook(() => useDailyMatchBudget(), { wrapper: makeWrapper(createAppQueryClient()) });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ budget: 5, used: 2, remaining: 3 });
  });

  it('falls back to budget minus used when remaining is omitted', async () => {
    mockMe.mockResolvedValue({ dailyMatchBudget: 4, dailyMatchesUsed: 6 });
    const { result } = renderHook(() => useDailyMatchBudget(), { wrapper: makeWrapper(createAppQueryClient()) });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.remaining).toBe(0);
  });
});
