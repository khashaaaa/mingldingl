import { renderHook } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeNudges } from '../useRealtimeNudges';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { queryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';
import type { Match } from '../../models/match';

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

function matchFixture(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'm1',
    otherUserId: 'u1',
    status: 'Active',
    revealLevel: 0,
    messageCount: 0,
    icebreakerComplete: false,
    videoCallUnlocked: false,
    otherUser: { displayName: 'Riley' },
    flameRiteDurationMinutes: 5,
    flameRiteRequired: true,
    videoEnabled: true,
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useRealtimeNudges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingNudge: null, activeChatMatchId: null, session: { user: { id: 'me1' } } as any });
    queryClient.removeQueries();
    queryClient.setQueryData(queryKeys.userProfile, { id: 'me1' });
  });

  function mount() {
    const { channel, handlers } = makeFakeChannel();
    mockChannelFn.mockReturnValue(channel);
    const view = renderHook(() => useRealtimeNudges(), { wrapper });
    return { ...view, channel, handlers };
  }

  // The engine stamps broadcasts with the account id, while the JWT sub is a throwaway anonymous
  // identity for every returning user. Filtering on the sub meant your own actions nudged you.
  it('treats a broadcast as mine by engine account id, not by the Supabase sub', () => {
    useAuthStore.setState({ session: { user: { id: 'throwaway-sub' } } as never });
    queryClient.setQueryData(queryKeys.userProfile, { id: 'engine-id' });
    const { handlers } = mount();

    handlers.icebreaker({ payload: { userId: 'engine-id', matchId: 'm1' } });

    expect(useAuthStore.getState().pendingNudge).toBeNull();
  });

  it('does not subscribe to a channel when there is no signed-in user', () => {
    useAuthStore.setState({ session: null });
    queryClient.removeQueries();
    renderHook(() => useRealtimeNudges(), { wrapper });
    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it('subscribes to the app-nudges channel with all ten broadcast handlers when signed in', () => {
    const { channel } = mount();
    expect(mockChannelFn).toHaveBeenCalledWith('app-nudges');
    expect(channel.on).toHaveBeenCalledTimes(10);
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('removes the channel on unmount', () => {
    const { channel, unmount } = mount();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  describe('icebreaker event', () => {
    it('sets a pending nudge when another user answers', () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm1', otherUser: { displayName: 'Riley' } })]);
      const { handlers } = mount();

      handlers.icebreaker({ payload: { userId: 'other-user', matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '🧊',
        title: 'Riley answered the icebreaker',
        matchId: 'm1',
      });
    });

    it('ignores the broadcast when the answering user is myself', () => {
      const { handlers } = mount();

      handlers.icebreaker({ payload: { userId: 'me1', matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it('falls back to a generic name when the match is not in the local cache', () => {
      const { handlers } = mount();

      handlers.icebreaker({ payload: { userId: 'other-user', matchId: 'unknown-match' } });

      expect(useAuthStore.getState().pendingNudge?.title).toBe('Your match answered the icebreaker');
    });

    it("invalidates the match's icebreaker reveal (prefix, since the questionId is unknown here)", () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.icebreaker({ payload: { userId: 'other-user', matchId: 'm1' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.icebreakerRevealByMatch('m1') });
    });

    it('does not invalidate anything for my own icebreaker answer', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.icebreaker({ payload: { userId: 'me1', matchId: 'm1' } });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('quiz event', () => {
    it('sets a pending nudge when another user completes the quiz', () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm1', otherUser: { displayName: 'Riley' } })]);
      const { handlers } = mount();

      handlers.quiz({ payload: { userId: 'other-user', matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '🎯',
        title: 'Riley completed the compatibility quiz',
        matchId: 'm1',
      });
    });

    it('ignores the broadcast when it was my own quiz completion', () => {
      const { handlers } = mount();
      handlers.quiz({ payload: { userId: 'me1', matchId: 'm1' } });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it('ignores the broadcast when matchId is null (no shared match yet)', () => {
      const { handlers } = mount();
      handlers.quiz({ payload: { userId: 'other-user', matchId: null } });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it("invalidates the match's quiz status (prefix, since the quizId is unknown here)", () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.quiz({ payload: { userId: 'other-user', matchId: 'm1' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.quizStatusByMatch('m1') });
    });
  });

  describe('date_confirmed event', () => {
    it("sets a pending nudge and refreshes activity suggestions + matches on the partner's confirmation", () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm1', otherUser: { displayName: 'Riley' } })]);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.date_confirmed({ payload: { matchId: 'm1', userId: 'other-user', isComplete: false } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '📍',
        title: 'Riley confirmed your date',
        matchId: 'm1',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.activitySuggestions('m1') });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
    });

    it("records that the partner has pledged (my turn) when their confirmation doesn't complete the pair", () => {
      const { handlers } = mount();

      handlers.date_confirmed({ payload: { matchId: 'm1', userId: 'other-user', isComplete: false } });

      expect(queryClient.getQueryData(queryKeys.partnerPledged('m1'))).toBe(true);
    });

    it('clears the partner-pledged flag once their confirmation completes the pair', () => {
      queryClient.setQueryData(queryKeys.partnerPledged('m1'), true);
      const { handlers } = mount();

      handlers.date_confirmed({ payload: { matchId: 'm1', userId: 'other-user', isComplete: true } });

      expect(queryClient.getQueryData(queryKeys.partnerPledged('m1'))).toBe(false);
    });

    it('ignores my own confirmation (no toast, no invalidation — my own mutation already handled it)', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.date_confirmed({ payload: { matchId: 'm1', userId: 'me1', isComplete: true } });

      expect(useAuthStore.getState().pendingNudge).toBeNull();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('flame_rite events', () => {
    it.each([
      ['flame_rite_proposed'],
      ['flame_rite_accepted'],
      ['flame_rite_declined'],
      ['flame_rite_completed'],
    ])('invalidates the matches cache on %s without setting a pending nudge', (event) => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture()]);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers[event]({ payload: { userId: 'other-user', matchId: 'm1' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });
  });

  describe('match_status_changed event', () => {
    it('invalidates matches (but not the thread) on a status change that keeps the match alive', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_status_changed({ payload: { matchId: 'm1', status: 'Active', userId: 'other-user' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.messages('m1') });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it.each([['Ghosted'], ['Completed']])('also invalidates the message thread when the status (%s) ends the match', (status) => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_status_changed({ payload: { matchId: 'm1', status, userId: 'other-user' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.messages('m1') });
    });

    it.each([['Unmatched'], ['Ghosted'], ['Active']])(
      'records the new status (%s) so an open chat screen can react to it',
      (status) => {
        // An ended match drops out of the matches list, so the chat screen has nothing left to read
        // the reason from — this cache entry is the only thing that reaches it.
        const { handlers } = mount();

        handlers.match_status_changed({ payload: { matchId: 'm1', status, userId: 'other-user' } });

        expect(queryClient.getQueryData(queryKeys.matchStatus('m1'))).toBe(status);
      },
    );
  });

  describe('message event', () => {
    it('sets a pending nudge for a message from the other person', () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm1', otherUser: { displayName: 'Riley' } })]);
      const { handlers } = mount();

      handlers.message({ payload: { senderId: 'other-user', matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '💬',
        title: 'Riley sent a message',
        matchId: 'm1',
      });
    });

    it('ignores a message broadcast that I sent myself', () => {
      const { handlers } = mount();
      handlers.message({ payload: { senderId: 'me1', matchId: 'm1' } });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it('suppresses the nudge when the message is for the chat currently open on screen', () => {
      useAuthStore.setState({ activeChatMatchId: 'm1' });
      const { handlers } = mount();

      handlers.message({ payload: { senderId: 'other-user', matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it('invalidates matches for a received message (revealLevel/messageCount consumers), even when the toast is suppressed', () => {
      useAuthStore.setState({ activeChatMatchId: 'm1' });
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.message({ payload: { senderId: 'other-user', matchId: 'm1' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
    });

    it('does not invalidate matches for my own message broadcast (my send mutation already does)', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.message({ payload: { senderId: 'me1', matchId: 'm1' } });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('still nudges for a different match while another chat is open', () => {
      useAuthStore.setState({ activeChatMatchId: 'm1' });
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm2', otherUser: { displayName: 'Casey' } })]);
      const { handlers } = mount();

      handlers.message({ payload: { senderId: 'other-user', matchId: 'm2' } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '💬',
        title: 'Casey sent a message',
        matchId: 'm2',
      });
    });
  });

  describe('match_created event', () => {
    it('ignores a match between two other people', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9', userIds: ['a', 'b'], source: 'like' } });

      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });

    it('ignores a malformed payload without userIds', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9' } });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('refreshes matches + discover + score and nudges me for a like-sourced match I am part of', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9', userIds: ['other-user', 'me1'], source: 'like' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.discover });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.score });
      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '✨',
        title: 'Fate has woven you a new match',
        matchId: 'm9',
      });
    });

    it('refreshes pending ships for a ship-sourced match', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9', userIds: ['me1', 'other-user'], source: 'ship' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.pendingShips });
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.discover });
    });

    it('refreshes the Town Square session for a townsquare-sourced match', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9', userIds: ['me1', 'other-user'], source: 'townsquare' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.townSquareNextSession });
    });

    it('still refreshes but does not nudge when the match is already in my cache (my own request added it)', () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm9' })]);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const { handlers } = mount();

      handlers.match_created({ payload: { matchId: 'm9', userIds: ['me1', 'other-user'], source: 'like' } });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
      expect(useAuthStore.getState().pendingNudge).toBeNull();
    });
  });
});
