import { renderHook } from '@testing-library/react-native';
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
    ...overrides,
  };
}

describe('useRealtimeNudges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingNudge: null, activeChatMatchId: null, session: { user: { id: 'me1' } } as any });
    queryClient.removeQueries();
  });

  function mount() {
    const { channel, handlers } = makeFakeChannel();
    mockChannelFn.mockReturnValue(channel);
    const view = renderHook(() => useRealtimeNudges());
    return { ...view, channel, handlers };
  }

  it('does not subscribe to a channel when there is no signed-in user', () => {
    useAuthStore.setState({ session: null });
    renderHook(() => useRealtimeNudges());
    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it('subscribes to the app-nudges channel with all four broadcast handlers when signed in', () => {
    const { channel } = mount();
    expect(mockChannelFn).toHaveBeenCalledWith('app-nudges');
    expect(channel.on).toHaveBeenCalledTimes(4);
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
  });

  describe('date_confirmed event', () => {
    it('sets a pending nudge unconditionally (no self-filter, unlike the others)', () => {
      queryClient.setQueryData(queryKeys.matches, [matchFixture({ matchId: 'm1', otherUser: { displayName: 'Riley' } })]);
      const { handlers } = mount();

      handlers.date_confirmed({ payload: { matchId: 'm1' } });

      expect(useAuthStore.getState().pendingNudge).toEqual({
        icon: '📍',
        title: 'Riley confirmed your date',
        matchId: 'm1',
      });
    });
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
});
