import { render } from '@testing-library/react-native';
import { QuestTile } from '../QuestTile';
import type { Match } from '../../../models/match';
import { fireOf, type Fire } from '../../../lib/fire';

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

/** Every fixture instant is a local-component `Date`, never a UTC literal — TZ-safe per the wave's
 *  own rule (see `lib/__tests__/fire.test.ts`, which this mirrors). */
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const windows = { staleHours: 48, unansweredHours: 168 };
const myId = 'me';
const now = at(2026, 9, 12, 9);

/** `CardEyebrow` upper-cases whatever it's given — the drawn label is `NEW QUEST`, not `New Quest`. */
const HIDDEN = { includeHiddenElements: true };

const UNLIT_FIRE: Fire = fireOf({ ...BASE_MATCH, createdAt: iso(at(2026, 9, 10, 9)) }, myId, now, windows);

const BURNING_FIRE: Fire = fireOf(
  {
    ...BASE_MATCH,
    createdAt: iso(at(2026, 9, 9, 9)),
    lastMessageAt: iso(at(2026, 9, 12, 8)),
    lastMessageSenderId: myId,
  },
  myId,
  now,
  windows,
);

const EMBERS_FIRE: Fire = fireOf(
  {
    ...BASE_MATCH,
    createdAt: iso(at(2026, 9, 8, 9)),
    lastMessageAt: iso(at(2026, 9, 10, 9)),
    lastMessageSenderId: 'them',
  },
  myId,
  now,
  windows,
);

const FROZEN_FIRE: Fire = fireOf(
  {
    ...BASE_MATCH,
    status: 'Ghosted',
    createdAt: iso(at(2026, 9, 1, 9)),
    lastMessageAt: iso(at(2026, 9, 7, 9)),
    lastMessageSenderId: myId,
  },
  myId,
  now,
  windows,
);

describe('QuestTile', () => {
  it('does not render a lock glyph for an unstarted quest — messaging is never gated', () => {
    const { UNSAFE_queryAllByProps, getByText } = render(
      <QuestTile match={BASE_MATCH} fire={UNLIT_FIRE} onPress={jest.fn()} />,
    );

    // A padlock states the thread is locked, but icebreakerComplete never gates messaging —
    // only the video-call button reads it (app/chat/[matchId].tsx).
    expect(UNSAFE_queryAllByProps({ name: 'lock' }).length).toBe(0);
    expect(UNSAFE_queryAllByProps({ name: 'script-text' }).length).toBeGreaterThan(0);
    expect(getByText('NEW QUEST')).toBeTruthy();
  });

  it('renders the burning eyebrow and line', () => {
    const { getByText } = render(<QuestTile match={BASE_MATCH} fire={BURNING_FIRE} onPress={jest.fn()} />);
    expect(getByText('BURNING')).toBeTruthy();
    expect(getByText('Fourth day. Their turn.')).toBeTruthy();
  });

  it('renders the embers eyebrow, line, and the ember mark, tinting the row hairline', () => {
    const { getByText, getByTestId } = render(<QuestTile match={BASE_MATCH} fire={EMBERS_FIRE} onPress={jest.fn()} />);
    expect(getByText('EMBERS')).toBeTruthy();
    expect(getByText('Your turn. Two dawns. Judged at the third.')).toBeTruthy();
    expect(getByTestId('state-ember', HIDDEN)).toBeTruthy();
  });

  it('does not render the ember mark outside the embers state', () => {
    const { queryByTestId } = render(<QuestTile match={BASE_MATCH} fire={BURNING_FIRE} onPress={jest.fn()} />);
    expect(queryByTestId('state-ember', HIDDEN)).toBeNull();
  });

  it('renders the frozen eyebrow, verdict, and a frost edge — absent otherwise', () => {
    const { getByText, getByTestId } = render(
      <QuestTile match={BASE_MATCH} fire={FROZEN_FIRE} onPress={jest.fn()} />,
    );
    expect(getByText('FROZEN')).toBeTruthy();
    expect(getByText('Five dawns of silence. Judged at the third.')).toBeTruthy();
    expect(getByText('They let it freeze. Their standing paid.')).toBeTruthy();
    expect(getByTestId('frost-edge-left', HIDDEN)).toBeTruthy();

    const { queryByTestId: queryOther } = render(<QuestTile match={BASE_MATCH} fire={BURNING_FIRE} onPress={jest.fn()} />);
    expect(queryOther('frost-edge-left', HIDDEN)).toBeNull();
  });

  it('labels the whole row for a screen reader as name, eyebrow, line', () => {
    const { getByLabelText } = render(<QuestTile match={BASE_MATCH} fire={BURNING_FIRE} onPress={jest.fn()} />);
    expect(getByLabelText('Riley. Burning. Fourth day. Their turn.')).toBeTruthy();
  });
});
