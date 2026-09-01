import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTownSquareSession } from '../useTownSquareSession';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { createAppQueryClient } from '../../lib/api/queryClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    townSquare: {
      nextSession: jest.fn(),
      rsvp: jest.fn(),
      cancelRsvp: jest.fn(),
    },
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockChannelFn = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

type BroadcastHandler = (msg: { payload: unknown }) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

function makeFakeChannel() {
  const handlers: Record<string, BroadcastHandler> = {};
  const channel: FakeChannel = {
    on: jest.fn((_type: string, opts: { event: string }, handler: BroadcastHandler) => {
      handlers[opts.event] = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return { channel, handlers };
}

const mockApi = apiClient as unknown as {
  townSquare: {
    nextSession: jest.Mock;
    rsvp: jest.Mock;
    cancelRsvp: jest.Mock;
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

describe('useTownSquareSession', () => {
  let fakeChannel: ReturnType<typeof makeFakeChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeChannel = makeFakeChannel();
    mockChannelFn.mockImplementation(() => fakeChannel.channel);
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

  // Polling used to stop entirely while a session ran, which left the tab frozen on a dead card
  // for anyone who left the round — nothing could tell it the session had finished.
  it('keeps polling (slowly) while the session is InProgress', async () => {
    jest.useFakeTimers();
    mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'InProgress', isRsvpd: true });

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(2);
  });

  it('polls fast (15s) while a session is upcoming', async () => {
    jest.useFakeTimers();
    mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Open', isRsvpd: false });

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(2);
  });

  it('backs off to a slow poll (60s) when no session is scheduled at all', async () => {
    jest.useFakeTimers();
    mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: null, isRsvpd: false });

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(45000);
    });
    expect(mockApi.townSquare.nextSession).toHaveBeenCalledTimes(2);
  });

  describe('session-scoped broadcast subscription', () => {
    it('subscribes to townsquare:{sessionId} while the session is upcoming', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Open', isRsvpd: false });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.session?.sessionId).toBe('s1'));
      await waitFor(() => expect(mockChannelFn).toHaveBeenCalledWith('townsquare:s1'));
      expect(fakeChannel.channel.subscribe).toHaveBeenCalled();
    });

    it('refetches the session immediately when session-started lands (no 15s poll gap at the start moment)', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Locked', isRsvpd: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.session?.status).toBe('Locked'));
      await waitFor(() => expect(fakeChannel.handlers['session-started']).toBeDefined());

      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'InProgress', isRsvpd: true });
      act(() => {
        fakeChannel.handlers['session-started']({ payload: { sessionId: 's1' } });
      });

      await waitFor(() => expect(result.current.session?.status).toBe('InProgress'));
    });

    it('refetches the session when session-cancelled lands', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Open', isRsvpd: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(fakeChannel.handlers['session-cancelled']).toBeDefined());

      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Cancelled', isRsvpd: true });
      act(() => {
        fakeChannel.handlers['session-cancelled']({ payload: { sessionId: 's1' } });
      });

      await waitFor(() => expect(result.current.session?.status).toBe('Cancelled'));
    });

    it('does not hold the townsquare:{sessionId} topic once the session is InProgress (the round screen owns it then)', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'InProgress', isRsvpd: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.session?.status).toBe('InProgress'));
      expect(mockChannelFn).not.toHaveBeenCalled();
    });

    it('does not subscribe at all when there is no session', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: null, isRsvpd: false });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockChannelFn).not.toHaveBeenCalled();
    });

    it('removes the channel on unmount', async () => {
      mockApi.townSquare.nextSession.mockResolvedValue({ sessionId: 's1', status: 'Open', isRsvpd: false });

      const queryClient = makeQueryClient();
      const { result, unmount } = renderHook(() => useTownSquareSession(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.session?.sessionId).toBe('s1'));
      await waitFor(() => expect(mockChannelFn).toHaveBeenCalled());
      unmount();
      expect(mockRemoveChannel).toHaveBeenCalledWith(fakeChannel.channel);
    });
  });
});
