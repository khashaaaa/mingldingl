import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMatchStatus, endedReasonFor } from '../useMatchStatus';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { matches: { ghostCheck: jest.fn() } },
}));

const mockGhostCheck = apiClient.matches.ghostCheck as jest.Mock;

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('endedReasonFor', () => {
  it.each([
    ['Active', null],
    ['Pending', null],
    ['Ghosted', 'ghosted'],
    ['Unmatched', 'ended'],
    ['Completed', 'ended'],
    [undefined, null],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(endedReasonFor(status as never)).toBe(expected);
  });
});

describe('useMatchStatus', () => {
  beforeEach(() => {
    mockGhostCheck.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('reports a live match as not ended', async () => {
    mockGhostCheck.mockResolvedValue({ status: 'Active' });

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('Active'));
    expect(result.current.endedReason).toBeNull();
  });

  it('surfaces a match the entry check finds already ghosted', async () => {
    mockGhostCheck.mockResolvedValue({ status: 'Ghosted' });

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });

    await waitFor(() => expect(result.current.endedReason).toBe('ghosted'));
  });

  it('picks up a partner unmatching mid-conversation from the broadcast cache write', async () => {
    mockGhostCheck.mockResolvedValue({ status: 'Active' });

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });
    await waitFor(() => expect(result.current.endedReason).toBeNull());

    // What useRealtimeNudges does on `match_status_changed`.
    act(() => {
      client.setQueryData(queryKeys.matchStatus('m1'), 'Unmatched');
    });

    await waitFor(() => expect(result.current.endedReason).toBe('ended'));
  });

  it('stays quiet when the entry check itself fails', async () => {
    mockGhostCheck.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });

    await waitFor(() => expect(mockGhostCheck).toHaveBeenCalled());
    expect(result.current.endedReason).toBeNull();
  });
});
