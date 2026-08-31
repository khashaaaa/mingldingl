import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTownSquareRound } from '../useTownSquareRound';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    townSquare: {
      currentRound: jest.fn(),
      joined: jest.fn(),
      respond: jest.fn(),
    },
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockApi = apiClient as unknown as {
  townSquare: {
    currentRound: jest.Mock;
    joined: jest.Mock;
    respond: jest.Mock;
  };
};

const mockChannelFn = supabase.channel as jest.Mock;

type BroadcastHandler = (msg: { payload: unknown }) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

function makeFakeChannel() {
  let roundAdvancedHandler: BroadcastHandler = () => {};
  const channel: FakeChannel = {
    on: jest.fn((_type: string, opts: { event: string }, handler: BroadcastHandler) => {
      if (opts.event === 'round-advanced') roundAdvancedHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return { channel, fireRoundAdvanced: (payload: unknown) => roundAdvancedHandler({ payload }) };
}

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

const round1 = {
  pairingId: 'p1',
  videoToken: 'tok1',
  channelName: 'chan1',
  appId: 'app1',
  icebreakerId: 'ib1',
  icebreakerText: 'Favorite trip?',
  icebreakerType: 'OpenText',
  icebreakerOptions: [],
  roundNumber: 1,
  roundEndsAt: '2026-08-14T20:04:00Z',
};

describe('useTownSquareRound', () => {
  let fakeChannel: ReturnType<typeof makeFakeChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel.channel);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps the current-round response into a normalized shape', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));
    expect(result.current.round).toEqual({
      pairingId: 'p1',
      videoToken: 'tok1',
      channelName: 'chan1',
      appId: 'app1',
      icebreakerId: 'ib1',
      icebreakerText: 'Favorite trip?',
      icebreakerType: 'OpenText',
      icebreakerOptions: [],
      roundNumber: 1,
      roundEndsAt: '2026-08-14T20:04:00Z',
    });
  });

  it('is disabled (does not call the API) when sessionId is undefined', async () => {
    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareRound(undefined), { wrapper: makeWrapper(queryClient) });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockApi.townSquare.currentRound).not.toHaveBeenCalled();
  });

  it('polls every 30s while mounted, as a fallback for a missed broadcast', async () => {
    jest.useFakeTimers();
    mockApi.townSquare.currentRound.mockResolvedValue(round1);

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.currentRound).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30000);
    });
    await waitFor(() => expect(mockApi.townSquare.currentRound).toHaveBeenCalledTimes(2));
  });

  it('refetches immediately when a "round-advanced" broadcast lands for this session', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);

    const queryClient = makeQueryClient();
    renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.townSquare.currentRound).toHaveBeenCalledTimes(1));

    const round2 = { ...round1, pairingId: 'p2', roundNumber: 2 };
    mockApi.townSquare.currentRound.mockResolvedValue(round2);
    act(() => {
      fakeChannel.fireRoundAdvanced({ sessionId: 's1', roundNumber: 2, status: 'InProgress' });
    });

    await waitFor(() => expect(mockApi.townSquare.currentRound).toHaveBeenCalledTimes(2));
  });

  it('markJoined calls the API with the current pairing id', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    mockApi.townSquare.joined.mockResolvedValue({});

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.markJoined('p1');
    });

    expect(mockApi.townSquare.joined).toHaveBeenCalledWith('p1');
  });

  it('submitResponse sends Yes/No and hasResponded reflects the current pairing only', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    mockApi.townSquare.respond.mockResolvedValue({ matchId: null });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));
    expect(result.current.hasResponded).toBe(false);

    await act(async () => {
      result.current.submitResponse('p1', 'Yes');
    });

    await waitFor(() => expect(result.current.hasResponded).toBe(true));
    expect(mockApi.townSquare.respond).toHaveBeenCalledWith('p1', 'Yes');
  });

  it('hasResponded resets once the round advances to a new pairing', async () => {
    mockApi.townSquare.currentRound.mockResolvedValueOnce(round1);
    mockApi.townSquare.respond.mockResolvedValue({ matchId: null });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.submitResponse('p1', 'Yes');
    });
    await waitFor(() => expect(result.current.hasResponded).toBe(true));

    const round2 = { ...round1, pairingId: 'p2', roundNumber: 2 };
    mockApi.townSquare.currentRound.mockResolvedValue(round2);
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p2'));
    expect(result.current.hasResponded).toBe(false);
  });

  it('invalidates the matches cache after responding (a mutual Yes creates a match)', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    mockApi.townSquare.respond.mockResolvedValue({ matchId: 'm1' });

    const queryClient = makeQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.submitResponse('p1', 'Yes');
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.matches })));
  });

  it('invalidates the matches cache after markJoined (joining can complete a pairing the partner already answered)', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    mockApi.townSquare.joined.mockResolvedValue({});

    const queryClient = makeQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.markJoined('p1');
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.matches })));
  });

  it('exposes matchId once the response result includes one', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    mockApi.townSquare.respond.mockResolvedValue({ matchId: 'm1' });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.submitResponse('p1', 'Yes');
    });

    await waitFor(() => expect(result.current.matchId).toBe('m1'));
  });

  it('ignores a second submitResponse while the first is still pending', async () => {
    mockApi.townSquare.currentRound.mockResolvedValue(round1);
    let resolveRespond: (v: any) => void = () => {};
    mockApi.townSquare.respond.mockReturnValue(new Promise((resolve) => { resolveRespond = resolve; }));

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useTownSquareRound('s1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.round?.pairingId).toBe('p1'));

    await act(async () => {
      result.current.submitResponse('p1', 'Yes');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => {
      result.current.submitResponse('p1', 'No');
    });

    expect(mockApi.townSquare.respond).toHaveBeenCalledTimes(1);
    expect(mockApi.townSquare.respond).toHaveBeenCalledWith('p1', 'Yes');

    await act(async () => {
      resolveRespond({ matchId: null });
    });
  });
});
