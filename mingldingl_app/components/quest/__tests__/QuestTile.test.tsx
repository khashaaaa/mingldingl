import { render } from '@testing-library/react-native';
import { QuestTile } from '../QuestTile';
import type { Match } from '../../../models/match';

const BASE_MATCH: Match = {
  matchId: 'm1',
  otherUserId: 'u2',
  status: 'Active',
  revealLevel: 2,
  messageCount: 0,
  icebreakerComplete: false,
  videoCallUnlocked: false,
  otherUser: { displayName: 'Riley' },
  flameRiteDurationMinutes: 5,
  flameRiteRequired: false,
  videoEnabled: true,
};

describe('QuestTile', () => {
  it('does not render a lock glyph for an unstarted quest — messaging is never gated', () => {
    const { UNSAFE_queryAllByProps, getByText } = render(
      <QuestTile match={BASE_MATCH} onPress={jest.fn()} />,
    );

    // A padlock states the thread is locked, but icebreakerComplete never gates messaging —
    // only the video-call button reads it (app/chat/[matchId].tsx).
    expect(UNSAFE_queryAllByProps({ name: 'lock' }).length).toBe(0);
    expect(UNSAFE_queryAllByProps({ name: 'script-text' }).length).toBeGreaterThan(0);
    expect(getByText('New Quest')).toBeTruthy();
  });
});
