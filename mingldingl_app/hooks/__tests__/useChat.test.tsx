import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useChat } from '../useChat';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
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

describe('useChat', () => {
  let fakeChannel: ReturnType<typeof makeFakeChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: { user: { id: 'me1' } } as never });
    mockList.mockResolvedValue([]);
    fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel.channel);
  });

  async function setup(queryClient = new QueryClient()) {
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

    // qc.setQueryData() runs synchronously, but TanStack Query's
    // notifyManager batches observer notifications via a real setTimeout(0)
    // (see notifyManager.ts's defaultScheduler), so the re-render that
    // surfaces the new data in `result.current` lands one real tick later —
    // a synchronous act() doesn't flush it. waitFor polls across that tick.
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({ content: 'hello there', senderId: 'me1', status: 'sending' });
    expect(result.current.messages[0].id).toMatch(/^local-/);

    // clean up the pending promise so it doesn't leak into the next test
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

    expect(mockSend).toHaveBeenCalledTimes(1); // no second send triggered
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
      // Same id rebroadcast (e.g. echoed back to the sender's own channel) —
      // must not produce a second entry.
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
      const queryClient = new QueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = await setup(queryClient);

      await act(async () => { await result.current.sendMessage('hey'); });

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(60);
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.quests }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.milestones }));
    });

    it('does not bump the score on an unawarded send, but still refreshes quests (progress can still advance)', async () => {
      // A third message in a row before the other person replies awards
      // neither FirstMessage nor MatchReply, but the "Exchange 5 Words"
      // daily quest's progress counter still advances server-side.
      mockSend.mockResolvedValue({
        message: { id: 'server-2', matchId: MATCH_ID, senderId: 'me1', content: 'still me', createdAt: 'now' },
        awarded: 0,
      });
      const queryClient = new QueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = await setup(queryClient);

      await act(async () => { await result.current.sendMessage('still me'); });

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(50);
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.quests }));
    });
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
});
