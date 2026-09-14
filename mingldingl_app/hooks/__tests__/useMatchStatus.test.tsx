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

  it('invalidates the matches list once ghost-check discovers a fresh Ghosted', async () => {
    mockGhostCheck.mockResolvedValue({ status: 'Ghosted' });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    renderHook(() => useMatchStatus('m1'), { wrapper });

    // Otherwise the match list's own 5-minute staleTime leaves it reading the pre-ghosting status
    // for as long as a screen reading `useMatches` stays mounted — see the hook's own comment.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches }));
  });

  it('leaves the matches list alone for a match that is still active', async () => {
    mockGhostCheck.mockResolvedValue({ status: 'Active' });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('Active'));

    expect(invalidateSpy).not.toHaveBeenCalled();
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

  // The app's QueryClient defaults to a 5-minute staleTime, which silently skipped the ghost check
  // on any re-entry into the chat inside that window.
  it('re-runs the ghost check on every entry, even under the app-wide staleTime', async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
    mockGhostCheck.mockResolvedValue({ status: 'Active' });

    const first = renderHook(() => useMatchStatus('m1'), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('Active'));
    first.unmount();

    renderHook(() => useMatchStatus('m1'), { wrapper });
    await waitFor(() => expect(mockGhostCheck).toHaveBeenCalledTimes(2));
  });

  it('stays quiet when the entry check itself fails', async () => {
    mockGhostCheck.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useMatchStatus('m1'), { wrapper });

    await waitFor(() => expect(mockGhostCheck).toHaveBeenCalled());
    expect(result.current.endedReason).toBeNull();
  });
});
