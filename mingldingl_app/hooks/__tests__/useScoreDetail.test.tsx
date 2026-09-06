import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useScoreDetail } from '../useScoreDetail';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { scores: { detail: jest.fn() } },
}));

const mockDetail = apiClient.scores.detail as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useScoreDetail', () => {
  beforeEach(() => {
    mockDetail.mockReset();
    useAuthStore.setState({ session: { access_token: 't' } as never });
  });

  it('reads the score detail once signed in', async () => {
    mockDetail.mockResolvedValue({ totalScore: 42, gemTier: 'Garnet' });

    const { result } = renderHook(() => useScoreDetail(), { wrapper });

    await waitFor(() => expect(result.current.data?.totalScore).toBe(42));
  });

  // RewardToastHost mounts this hook in the root layout, so it renders on the sign-in screen
  // too. Un-gated it fired /scores/detail with no token, and the 401 reached the global
  // QueryCache.onError as a "Couldn't load" alert over the phone-number screen.
  it('does not call the engine without a session', () => {
    useAuthStore.setState({ session: null });

    renderHook(() => useScoreDetail(), { wrapper });

    expect(mockDetail).not.toHaveBeenCalled();
  });
});
