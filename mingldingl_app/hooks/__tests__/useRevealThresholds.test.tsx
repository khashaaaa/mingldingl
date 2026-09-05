import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useRevealThresholds } from '../useRevealThresholds';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { nextRevealThreshold, resetRevealThresholdsForTests } from '../../lib/reveal';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { engagement: { revealThresholds: jest.fn() } },
}));

const mockThresholds = apiClient.engagement.revealThresholds as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRevealThresholds', () => {
  beforeEach(() => {
    resetRevealThresholdsForTests();
    mockThresholds.mockReset();
    useAuthStore.setState({ session: { access_token: 't' } as never });
  });

  it('hydrates the reveal ladder from the engine once signed in', async () => {
    mockThresholds.mockResolvedValue({
      levels: [{ level: 1, messages: 1 }, { level: 2, messages: 9 }, { level: 3, messages: 15 }, { level: 4, messages: 30 }],
    });

    renderHook(() => useRevealThresholds(), { wrapper });

    await waitFor(() => expect(nextRevealThreshold(0)).toBe(9));
  });

  it('does not call the engine without a session', () => {
    useAuthStore.setState({ session: null });

    renderHook(() => useRevealThresholds(), { wrapper });

    expect(mockThresholds).not.toHaveBeenCalled();
  });
});
