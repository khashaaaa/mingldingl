import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTownSquareSession } from '../useTownSquareSession';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    townSquare: {
      nextSession: jest.fn(),
      rsvp: jest.fn(),
      cancelRsvp: jest.fn(),
    },
  },
}));

const mockApi = apiClient as unknown as {
  townSquare: {
    nextSession: jest.Mock;
    rsvp: jest.Mock;
    cancelRsvp: jest.Mock;
  };
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTownSquareSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps the next-session response into a normalized shape', async () => {
    mockApi.townSquare.nextSession.mockResolvedValue({
      sessionId: 's1',
      rsvpOpensAt: '2026-08-14T00:00:00Z',
      rsvpClosesAt: '2026-08-14T18:00:00Z',
      scheduledStartAt: '2026-08-14T20:00:00Z',
      status: 'Open',
      isRsvpd: false,
    });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.session?.sessionId).toBe('s1'));
    expect(result.current.session).toEqual({
      sessionId: 's1',
      rsvpOpensAt: '2026-08-14T00:00:00Z',
      rsvpClosesAt: '2026-08-14T18:00:00Z',
      scheduledStartAt: '2026-08-14T20:00:00Z',
      status: 'Open',
      isRsvpd: false,
    });
  });

  it('handles no upcoming session by mapping to a null sessionId', async () => {
    mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: null, isRsvpd: false });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session?.sessionId).toBeNull();
  });

  it('rsvp() calls the API and invalidates next-session so isRsvpd refreshes', async () => {
    mockApi.townSquare.nextSession
      .mockResolvedValueOnce({ sessionId: 's1', status: 'Open', isRsvpd: false })
      .mockResolvedValueOnce({ sessionId: 's1', status: 'Open', isRsvpd: true });
    mockApi.townSquare.rsvp.mockResolvedValue({});

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.session?.isRsvpd).toBe(false));

    await act(async () => {
      result.current.rsvp('s1');
    });

    await waitFor(() => expect(mockApi.townSquare.rsvp).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(result.current.session?.isRsvpd).toBe(true));
  });

  it('cancelRsvp() calls the API and invalidates next-session', async () => {
    mockApi.townSquare.nextSession
      .mockResolvedValueOnce({ sessionId: 's1', status: 'Open', isRsvpd: true })
      .mockResolvedValueOnce({ sessionId: 's1', status: 'Open', isRsvpd: false });
    mockApi.townSquare.cancelRsvp.mockResolvedValue({});

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.session?.isRsvpd).toBe(true));

    await act(async () => {
      result.current.cancelRsvp('s1');
    });

    await waitFor(() => expect(mockApi.townSquare.cancelRsvp).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(result.current.session?.isRsvpd).toBe(false));
  });

  it('stops polling once the session is InProgress', async () => {
    jest.useFakeTimers();
    mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'InProgress', isRsvpd: true });

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });

    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1);
  });
});
