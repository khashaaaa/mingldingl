import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import { useIcebreaker } from '../useIcebreaker';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';

function notCompleteYetError() {
  // RevealIcebreaker returns 400 while both users haven't responded yet —
  // the one error shape the poll should keep retrying through.
  const err = new AxiosError('Request failed with status code 400');
  err.response = { status: 400, data: { error: 'Icebreaker not complete yet' } } as AxiosError['response'];
  return err;
}

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    engagement: {
      icebreaker: jest.fn(),
      icebreakerReveal: jest.fn(),
      icebreakerRespond: jest.fn(),
      icebreakerStatus: jest.fn(),
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
  engagement: {
    icebreaker: jest.Mock;
    icebreakerReveal: jest.Mock;
    icebreakerRespond: jest.Mock;
    icebreakerStatus: jest.Mock;
  };
};

const mockChannelFn = supabase.channel as jest.Mock;

type BroadcastHandler = (msg: { payload: unknown }) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

function makeFakeChannel() {
  let icebreakerHandler: BroadcastHandler = () => {};
  const channel: FakeChannel = {
    on: jest.fn((_type: string, opts: { event: string }, handler: BroadcastHandler) => {
      if (opts.event === 'icebreaker') icebreakerHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return { channel, fireIcebreaker: (payload: unknown) => icebreakerHandler({ payload }) };
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

const question = { id: 'q1', questionText: 'Fave food?', type: 'text', options: [] };

describe('useIcebreaker', () => {
  let fakeChannel: ReturnType<typeof makeFakeChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: { user: { id: 'me' } } as any });
    // Default: server says I haven't responded yet. respond's onSuccess
    // writes { hasResponded: true } straight into this query's cache, so
    // most tests never need to override this mock's resolved value.
    mockApi.engagement.icebreakerStatus.mockResolvedValue({ hasResponded: false });
    fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel.channel);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('reveal polling (refetchInterval gated on data presence)', () => {
    it('keeps polling every 15s while the reveal fetch keeps 400ing ("not complete yet")', async () => {
      jest.useFakeTimers();
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockRejectedValue(notCompleteYetError());

      const queryClient = makeQueryClient();
      renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(2));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(3));
    });

    it('stops polling (does not retry forever) once the reveal fetch fails with a real error', async () => {
      jest.useFakeTimers();
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      const notFound = new AxiosError('Request failed with status code 404');
      notFound.response = { status: 404, data: { error: 'Match not found' } } as AxiosError['response'];
      mockApi.engagement.icebreakerReveal.mockRejectedValue(notFound);

      const queryClient = makeQueryClient();
      renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });

      // A permanent failure must not retry forever the way "not complete
      // yet" (400) legitimately does.
      expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1);
    });

    it('stops polling once the reveal fetch resolves with data (even an empty array)', async () => {
      jest.useFakeTimers();
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue([]);

      const queryClient = makeQueryClient();
      renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });

      // No further calls: refetchInterval saw a truthy `data` ([]) and returned false.
      expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcast-driven reveal refetch', () => {
    it('refetches the reveal immediately when an app-nudges "icebreaker" broadcast lands for this match', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);

      const queryClient = makeQueryClient();
      renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1));

      mockApi.engagement.icebreakerReveal.mockResolvedValue([
        { userId: 'me', answer: 'pizza' },
        { userId: 'them', answer: 'sushi' },
      ]);
      act(() => {
        fakeChannel.fireIcebreaker({ userId: 'them', matchId: 'm1' });
      });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(2));
    });

    it('ignores a broadcast for a different match', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);

      const queryClient = makeQueryClient();
      renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1));

      act(() => {
        fakeChannel.fireIcebreaker({ userId: 'them', matchId: 'other-match' });
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockApi.engagement.icebreakerReveal).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitAnswer double-submit guard', () => {
    it('ignores a second submitAnswer call while the first is still pending', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      let resolveRespond: (v: any) => void = () => {};
      mockApi.engagement.icebreakerRespond.mockReturnValue(
        new Promise((resolve) => { resolveRespond = resolve; }),
      );

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.question).toEqual(question));

      await act(async () => {
        result.current.submitAnswer('pizza');
        // react-query batches its state notifications via a macrotask
        // (notifyManager), so give it a real tick to flip isPending to true
        // before we try the second submit.
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      // Still pending: the respond promise above hasn't been resolved yet.
      act(() => {
        result.current.submitAnswer('sushi');
      });

      expect(mockApi.engagement.icebreakerRespond).toHaveBeenCalledTimes(1);
      expect(mockApi.engagement.icebreakerRespond).toHaveBeenCalledWith('m1', { icebreakerId: 'q1', answer: 'pizza' });

      await act(async () => {
        resolveRespond({ bothResponded: false });
      });
      await waitFor(() => expect(result.current.hasResponded).toBe(true));

      // Guard also blocks resubmission after success, not just while pending.
      act(() => {
        result.current.submitAnswer('sushi');
      });
      expect(mockApi.engagement.icebreakerRespond).toHaveBeenCalledTimes(1);
    });

    it('invalidates the reveal query only when the response says bothResponded', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      mockApi.engagement.icebreakerRespond.mockResolvedValue({ bothResponded: true });

      const queryClient = makeQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.question).toEqual(question));

      await act(async () => {
        result.current.submitAnswer('pizza');
      });

      await waitFor(() => expect(result.current.hasResponded).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['icebreakerReveal', 'm1', 'q1'] }),
      );
    });

    it('exposes submitError and clears it via clearSubmitError', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      mockApi.engagement.icebreakerRespond.mockRejectedValue(new Error('boom'));

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.question).toEqual(question));

      await act(async () => {
        result.current.submitAnswer('pizza');
      });

      await waitFor(() => expect(result.current.submitError).toBe(true));
      expect(result.current.hasResponded).toBe(false);

      act(() => {
        result.current.clearSubmitError();
      });
      await waitFor(() => expect(result.current.submitError).toBe(false));

      // Guard is keyed off isPending/isSuccess, not isError — a cleared error
      // allows retrying the submit.
      mockApi.engagement.icebreakerRespond.mockResolvedValue({ bothResponded: false });
      await act(async () => {
        result.current.submitAnswer('pizza');
      });
      await waitFor(() => expect(result.current.hasResponded).toBe(true));
      expect(mockApi.engagement.icebreakerRespond).toHaveBeenCalledTimes(2);
    });
  });

  describe('server-derived hasResponded (survives remount)', () => {
    it('reports hasResponded true on a fresh mount when the server already has my response', async () => {
      // Simulates leaving the waiting screen and coming back: local mutation
      // state is gone (fresh hook instance), but the server still knows.
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      mockApi.engagement.icebreakerStatus.mockResolvedValue({ hasResponded: true });

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.hasResponded).toBe(true));
      expect(result.current.isWaitingForPartner).toBe(true);
      // Never having called submitAnswer this mount, a resubmit attempt must
      // still be blocked — otherwise reopening the screen risks a 409.
      result.current.submitAnswer('sushi');
      expect(mockApi.engagement.icebreakerRespond).not.toHaveBeenCalled();
    });
  });

  describe('score bump only reflects a real award', () => {
    const baseScoreDetail = {
      totalScore: 50, gemTier: 'Garnet', reputationScore: 1, currentStreak: 0, longestStreak: 0,
      tierIndex: 0, tierBonus: 0, nextTier: 'Opal', nextTierThreshold: 100, progressPct: 50,
      dailyMatchBudget: 5,
    };

    it('does NOT bump the score when I am first to respond (bothResponded false, nothing awarded yet)', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      mockApi.engagement.icebreakerRespond.mockResolvedValue({ bothResponded: false, awarded: 0 });

      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.question).toEqual(question));
      await act(async () => { result.current.submitAnswer('pizza'); });
      await waitFor(() => expect(result.current.hasResponded).toBe(true));

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(50);
    });

    it('bumps the score by the server-reported award when I complete the icebreaker (bothResponded true)', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue(null);
      mockApi.engagement.icebreakerRespond.mockResolvedValue({ bothResponded: true, awarded: 20 });

      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.question).toEqual(question));
      await act(async () => { result.current.submitAnswer('pizza'); });
      await waitFor(() => expect(result.current.hasResponded).toBe(true));

      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(70);
    });
  });

  describe('derived reveal state', () => {
    it('splits reveal entries into myAnswer/partnerAnswer by session user id', async () => {
      mockApi.engagement.icebreaker.mockResolvedValue(question);
      mockApi.engagement.icebreakerReveal.mockResolvedValue([
        { userId: 'me', answer: 'pizza' },
        { userId: 'them', answer: 'sushi' },
      ]);

      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useIcebreaker('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.isComplete).toBe(true));
      expect(result.current.myAnswer).toBe('pizza');
      expect(result.current.partnerAnswer).toBe('sushi');
    });
  });
});
