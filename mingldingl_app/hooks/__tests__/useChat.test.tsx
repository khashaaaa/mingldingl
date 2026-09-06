import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useChat } from '../useChat';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    messages: {
      list: jest.fn(),
      send: jest.fn(),
    },
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockList = apiClient.messages.list as jest.Mock;
const mockSend = apiClient.messages.send as jest.Mock;
const mockChannelFn = supabase.channel as jest.Mock;

type BroadcastHandler = (msg: { payload: unknown }) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

function makeFakeChannel() {
  let insertHandler: BroadcastHandler = () => {};
  const channel: FakeChannel = {
    on: jest.fn((_type: string, opts: { event: string }, handler: BroadcastHandler) => {
      if (opts.event === 'INSERT') insertHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return { channel, fireInsert: (payload: unknown) => insertHandler({ payload }) };
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const MATCH_ID = 'match-1';

/** Shaped like the axios error the engine's `match.inactive` DomainException produces. */
function matchInactiveError() {
  return Object.assign(new Error('Request failed with status code 403'), {
    isAxiosError: true,
    response: { status: 403, data: { error: 'This match is no longer active', code: 'match.inactive' } },
  });
}

describe('useChat', () => {
  let fakeChannel: ReturnType<typeof makeFakeChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: { user: { id: 'me1' } } as never });
    mockList.mockResolvedValue([]);
    fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel.channel);
  });

  async function setup(queryClient = createAppQueryClient()) {
    const view = renderHook(() => useChat(MATCH_ID), { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await waitFor(() => expect(view.result.current.myId).toBe('me1'));
    return { queryClient, ...view };
  }

  it('loads the initial message list with status implicitly "sent"', async () => {
    mockList.mockResolvedValue([
      { id: 's1', matchId: MATCH_ID, senderId: 'them', content: 'hey', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const { result } = await setup();

    expect(result.current.messages).toEqual([
      { id: 's1', matchId: MATCH_ID, senderId: 'them', content: 'hey', createdAt: '2024-01-01T00:00:00Z', status: 'sent' },
    ]);
  });

  it('sendMessage optimistically inserts a "sending" message with a local temp id before the API resolves', async () => {
    let resolveSend!: (v: unknown) => void;
    mockSend.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve; }));
    const { result } = await setup();

    act(() => {
      void result.current.sendMessage('hello there');
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({ content: 'hello there', senderId: 'me1', status: 'sending' });
    expect(result.current.messages[0].id).toMatch(/^local-/);

    await act(async () => { resolveSend({ message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hello there', createdAt: 'now' } }); });
  });

  it('reconciles the optimistic message with the server response: temp id removed, server id added, no duplicate', async () => {
    mockSend.mockResolvedValue({ message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hello there', createdAt: '2024-01-02T00:00:00Z' } });
    const { result } = await setup();

    await act(async () => { await result.current.sendMessage('hello there'); });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toEqual({
      id: 'server-1',
      matchId: MATCH_ID,
      senderId: 'me1',
      content: 'hello there',
      createdAt: '2024-01-02T00:00:00Z',
      status: 'sent',
    });
    expect(result.current.messages.some((m) => m.id.startsWith('local-'))).toBe(false);
  });

  it('marks the optimistic message as "failed" (not removed) when the send rejects', async () => {
    mockSend.mockRejectedValue(new Error('offline'));
    const { result } = await setup();

    await act(async () => { await result.current.sendMessage('will fail'); });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({ content: 'will fail', status: 'failed' });
    expect(result.current.messages[0].id).toMatch(/^local-/);
  });

  it('records the match as ended when a send is refused with 403 match.inactive', async () => {
    // The partner unmatched or blocked while this screen was open. Without this the bubble just
    // says "tap to retry" forever and the screen never explains why nothing will ever send.
    mockSend.mockRejectedValue(matchInactiveError());
    const { result, queryClient } = await setup();

    await act(async () => { await result.current.sendMessage('into the void'); });

    // Wait on the rendered value, not the cache: getQueryData reads through synchronously and can
    // satisfy waitFor a render before the hook has re-rendered, leaving messages[0] undefined.
    await waitFor(() => expect(result.current.messages[0]).toMatchObject({ status: 'failed' }));
    expect(queryClient.getQueryData(queryKeys.matchStatus(MATCH_ID))).toBe('Unmatched');
  });

  it('leaves the match status alone when a send fails for an ordinary network reason', async () => {
    mockSend.mockRejectedValue(new Error('offline'));
    const { result, queryClient } = await setup();

    await act(async () => { await result.current.sendMessage('retry me later'); });

    await waitFor(() => expect(result.current.messages[0]).toMatchObject({ status: 'failed' }));
    expect(queryClient.getQueryData(queryKeys.matchStatus(MATCH_ID))).toBeUndefined();
  });

  it('retryMessage resends a failed message and flips it back to sent on success', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'));
    const { result } = await setup();
    await act(async () => { await result.current.sendMessage('retry me'); });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    await waitFor(() => expect(result.current.messages[0].status).toBe('failed'));
    const failedId = result.current.messages[0].id;

    mockSend.mockResolvedValueOnce({ message: { id: 'server-9', matchId: MATCH_ID, senderId: 'me1', content: 'retry me', createdAt: '2024-01-03T00:00:00Z' } });
    await act(async () => { result.current.retryMessage(failedId); await Promise.resolve(); });
    await waitFor(() => expect(result.current.messages[0].status).toBe('sent'));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('server-9');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('retryMessage is a no-op for a message that is not in the "failed" state', async () => {
    mockSend.mockResolvedValue({ message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'ok', createdAt: 'now' } });
    const { result } = await setup();
    await act(async () => { await result.current.sendMessage('ok'); });
    await waitFor(() => expect(result.current.messages[0]?.status).toBe('sent'));
    const sentId = result.current.messages[0].id;

    act(() => { result.current.retryMessage(sentId); });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.current.messages[0].status).toBe('sent');
  });

  it('retryMessage on an unknown id does nothing', async () => {
    const { result } = await setup();
    act(() => { result.current.retryMessage('does-not-exist'); });
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('realtime broadcast INSERT appends a new message not already present', async () => {
    const { result } = await setup();

    act(() => {
      fakeChannel.fireInsert({ id: 'r1', matchId: MATCH_ID, senderId: 'them', content: 'incoming', createdAt: '2024-01-04T00:00:00Z' });
    });

    await waitFor(() => expect(result.current.messages).toEqual([
      { id: 'r1', matchId: MATCH_ID, senderId: 'them', content: 'incoming', createdAt: '2024-01-04T00:00:00Z', status: 'sent' },
    ]));
  });

  it('realtime broadcast INSERT dedupes by message id instead of appending a duplicate', async () => {
    mockList.mockResolvedValue([
      { id: 'r1', matchId: MATCH_ID, senderId: 'them', content: 'incoming', createdAt: '2024-01-04T00:00:00Z' },
    ]);
    const { result } = await setup();
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      fakeChannel.fireInsert({ id: 'r1', matchId: MATCH_ID, senderId: 'them', content: 'incoming', createdAt: '2024-01-04T00:00:00Z' });
    });

    expect(result.current.messages).toHaveLength(1);
  });

  describe('score/quest reflection on send', () => {
    const baseScoreDetail = {
      totalScore: 50, gemTier: 'Garnet', reputationScore: 1, currentStreak: 0, longestStreak: 0,
      tierIndex: 0, tierBonus: 0, nextTier: 'Opal', nextTierThreshold: 100, progressPct: 50,
      dailyMatchBudget: 5,
    };

    it('bumps the score by the server-reported award (e.g. FirstMessage) and refreshes quests/milestones', async () => {
      mockSend.mockResolvedValue({
        message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hey', createdAt: 'now' },
        awarded: 10,
      });
      const queryClient = createAppQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = await setup(queryClient);

      await act(async () => { await result.current.sendMessage('hey'); });

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(60);
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.quests }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.milestones }));
    });

    it('does not bump the score on an unawarded send, but still refreshes quests (progress can still advance)', async () => {
      mockSend.mockResolvedValue({
        message: { id: 'server-2', matchId: MATCH_ID, senderId: 'me1', content: 'still me', createdAt: 'now' },
        awarded: 0,
      });
      const queryClient = createAppQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = await setup(queryClient);

      await act(async () => { await result.current.sendMessage('still me'); });

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(50);
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.quests }));
    });
  });

  it('gives two sends in the same millisecond distinct temp ids (neither bubble is dropped)', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1755000000000);
    try {
      mockSend.mockImplementation(() => new Promise(() => {}));
      const { result } = await setup();

      act(() => {
        void result.current.sendMessage('first');
        void result.current.sendMessage('second');
      });

      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      const [a, b] = result.current.messages;
      expect(a.id).not.toBe(b.id);
      expect(result.current.messages.map((m) => m.content)).toEqual(['first', 'second']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('a refetch merges with the cache instead of replacing it: failed bubbles survive, server messages dedupe by id', async () => {
    mockSend.mockRejectedValue(new Error('offline'));
    mockList.mockResolvedValue([
      { id: 's1', matchId: MATCH_ID, senderId: 'them', content: 'hey', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const { result } = await setup();
    await act(async () => { await result.current.sendMessage('will fail'); });
    await waitFor(() => expect(result.current.messages.some((m) => m.status === 'failed')).toBe(true));

    mockList.mockResolvedValue([
      { id: 's1', matchId: MATCH_ID, senderId: 'them', content: 'hey', createdAt: '2024-01-01T00:00:00Z' },
      { id: 's2', matchId: MATCH_ID, senderId: 'them', content: 'missed you', createdAt: '2024-01-01T00:01:00Z' },
    ]);
    await act(async () => { await result.current.refetch(); });

    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    const ids = result.current.messages.map((m) => m.id);
    expect(ids.filter((id) => id === 's1')).toHaveLength(1);
    expect(ids).toContain('s2');
    const failed = result.current.messages.find((m) => m.status === 'failed');
    expect(failed?.content).toBe('will fail');
  });

  it('send refreshes the matches cache (revealLevel/messageCount consumers) via meta.invalidates', async () => {
    mockSend.mockResolvedValue({ message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hey', createdAt: 'now' } });
    const queryClient = createAppQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await setup(queryClient);

    await act(async () => { await result.current.sendMessage('hey'); });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.matches }));
  });

  it('realtime broadcast that echoes back my own just-sent message does not duplicate it', async () => {
    mockSend.mockResolvedValue({ message: { id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hi', createdAt: '2024-01-05T00:00:00Z' } });
    const { result } = await setup();
    await act(async () => { await result.current.sendMessage('hi'); });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      fakeChannel.fireInsert({ id: 'server-1', matchId: MATCH_ID, senderId: 'me1', content: 'hi', createdAt: '2024-01-05T00:00:00Z' });
    });

    expect(result.current.messages).toHaveLength(1);
  });

  describe('loadEarlier / hasMore', () => {
    const PAGE = 50;
    function serverPage(start: number, count: number) {
      return Array.from({ length: count }, (_, i) => {
        const n = start + i;
        return { id: `s${n}`, matchId: MATCH_ID, senderId: 'them', content: `msg ${n}`, createdAt: `2024-01-01T00:${String(n).padStart(2, '0')}:00Z` };
      });
    }

    it('reports hasMore=false when the first page is short of a full page', async () => {
      mockList.mockResolvedValue(serverPage(1, 3));
      const { result } = await setup();

      expect(mockList).toHaveBeenCalledWith(MATCH_ID, { limit: PAGE });
      expect(result.current.hasMore).toBe(false);
      await act(async () => { await result.current.loadEarlier(); });
      expect(mockList).toHaveBeenCalledTimes(1);
    });

    it('reports hasMore=true when the first page is full, and loadEarlier requests the page before the oldest message', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();
      expect(result.current.hasMore).toBe(true);

      mockList.mockResolvedValueOnce(serverPage(45, 5));
      await act(async () => { await result.current.loadEarlier(); });

      expect(mockList).toHaveBeenLastCalledWith(MATCH_ID, { before: '2024-01-01T00:50:00Z', beforeId: 's50', limit: PAGE });
      await waitFor(() => expect(result.current.messages).toHaveLength(55));
      expect(result.current.messages[0].id).toBe('s45');
      expect(result.current.messages[5].id).toBe('s50');
      expect(result.current.hasMore).toBe(false);
    });

    it('anchors on the lower id when the oldest two messages share a createdAt, so neither is skipped', async () => {
      const tied = serverPage(50, PAGE);
      tied[0] = { ...tied[0], id: 's50b' };
      tied[1] = { ...tied[1], id: 's50a', createdAt: tied[0].createdAt };
      mockList.mockResolvedValueOnce(tied);
      const { result } = await setup();

      mockList.mockResolvedValueOnce([]);
      await act(async () => { await result.current.loadEarlier(); });

      expect(mockList).toHaveBeenLastCalledWith(
        MATCH_ID, { before: '2024-01-01T00:50:00Z', beforeId: 's50a', limit: PAGE });
    });

    it('keeps hasMore=true after a full earlier page and dedupes overlapping ids', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();

      mockList.mockResolvedValueOnce([...serverPage(1, PAGE - 1), serverPage(50, 1)[0]]);
      await act(async () => { await result.current.loadEarlier(); });

      await waitFor(() => expect(result.current.messages).toHaveLength(99));
      expect(new Set(result.current.messages.map((m) => m.id)).size).toBe(99);
      expect(result.current.hasMore).toBe(true);
    });

    it('ignores optimistic (unsent) bubbles when picking the oldest anchor', async () => {
      mockSend.mockImplementation(() => new Promise(() => {}));
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();
      act(() => { void result.current.sendMessage('pending'); });
      await waitFor(() => expect(result.current.messages.some((m) => m.status === 'sending')).toBe(true));

      mockList.mockResolvedValueOnce([]);
      await act(async () => { await result.current.loadEarlier(); });

      expect(mockList).toHaveBeenLastCalledWith(MATCH_ID, { before: '2024-01-01T00:50:00Z', beforeId: 's50', limit: PAGE });
    });

    it('leaves the cache and hasMore untouched when the earlier fetch fails', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();

      mockList.mockRejectedValueOnce(new Error('offline'));
      await act(async () => { await result.current.loadEarlier(); });

      expect(result.current.messages).toHaveLength(PAGE);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.loadingEarlier).toBe(false);
    });

    it('surfaces earlierError when the page fails, and clears it on a successful retry', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();

      mockList.mockRejectedValueOnce(new Error('offline'));
      await act(async () => { await result.current.loadEarlier(); });
      expect(result.current.earlierError).toBe(true);

      mockList.mockResolvedValueOnce(serverPage(45, 5));
      await act(async () => { await result.current.loadEarlier(); });
      expect(result.current.earlierError).toBe(false);
    });

    it('flags justLoadedEarlier so the list does not scroll back to the bottom', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();
      expect(result.current.justLoadedEarlier).toBe(false);

      mockList.mockResolvedValueOnce(serverPage(45, 5));
      await act(async () => { await result.current.loadEarlier(); });
      expect(result.current.justLoadedEarlier).toBe(true);

      // The list acknowledges once the prepended page has been measured.
      act(() => result.current.acknowledgeEarlierLoaded());
      expect(result.current.justLoadedEarlier).toBe(false);
    });

    it('does not flag justLoadedEarlier when the earlier fetch failed', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();

      mockList.mockRejectedValueOnce(new Error('offline'));
      await act(async () => { await result.current.loadEarlier(); });

      expect(result.current.justLoadedEarlier).toBe(false);
    });

    it('keeps earlier pages through a refetch instead of collapsing to the newest page', async () => {
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      const { result } = await setup();

      mockList.mockResolvedValueOnce(serverPage(45, 5));
      await act(async () => { await result.current.loadEarlier(); });
      await waitFor(() => expect(result.current.messages).toHaveLength(55));

      // A background refetch returns only the newest page.
      mockList.mockResolvedValueOnce(serverPage(50, PAGE));
      await act(async () => { await result.current.refetch(); });

      await waitFor(() => expect(result.current.messages).toHaveLength(55));
      expect(result.current.messages[0].id).toBe('s45');
    });
  });
});
