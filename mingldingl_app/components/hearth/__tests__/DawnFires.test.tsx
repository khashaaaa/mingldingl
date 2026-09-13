import { fireEvent, render } from '@testing-library/react-native';
import { DawnFires } from '../DawnFires';
import { fireOf } from '../../../lib/fire';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

/** The engine's own windows, read rather than re-derived — same shape `useGhostingWindows` hands
 *  the Quest Log. */
const WINDOWS = { staleHours: 48, unansweredHours: 24 };
const MY_ID = 'me';

/** Built from local components, never a UTC literal: a dawn is a local midnight, so a fixture
 *  written as `Z` lands on a different day either side of the date line. */
const NOW = new Date(2026, 8, 13, 10).getTime();

/** A row's mark is decorative — the row's own sentence carries the state — so it is hidden from
 *  assistive tech and from the default queries with it, the same opt-in `QuestTile`'s suite makes. */
const HIDDEN = { includeHiddenElements: true };

function at(daysAgo: number, hour: number): string {
  return new Date(2026, 8, 13 - daysAgo, hour).toISOString();
}

const BURNING = fireOf(
  { status: 'Active', createdAt: at(1, 9), lastMessageAt: at(0, 9), lastMessageSenderId: 'u2', messageCount: 4 },
  MY_ID, NOW, WINDOWS,
);
const EMBERS = fireOf(
  { status: 'Active', createdAt: at(4, 9), lastMessageAt: at(2, 9), lastMessageSenderId: 'u2', messageCount: 6 },
  MY_ID, NOW, WINDOWS,
);
const FROZEN = fireOf(
  { status: 'Ghosted', createdAt: at(9, 9), lastMessageAt: at(5, 9), lastMessageSenderId: MY_ID, messageCount: 3 },
  MY_ID, NOW, WINDOWS,
);
const UNLIT = fireOf(
  { status: 'Active', createdAt: at(0, 8), lastMessageAt: undefined, lastMessageSenderId: undefined, messageCount: 0 },
  MY_ID, NOW, WINDOWS,
);

beforeEach(() => {
  mockPush.mockClear();
});

describe('the fixtures are the states they claim to be', () => {
  it('reads burning, embers, frozen and unlit off `fireOf` rather than asserting them by hand', () => {
    expect([BURNING.state, EMBERS.state, FROZEN.state, UNLIT.state]).toEqual([
      'burning', 'embers', 'frozen', 'unlit',
    ]);
  });
});

describe('DawnFires', () => {
  it('leads with the judged: frozen, then embers, then the fires still burning', () => {
    const { getAllByTestId } = render(
      <DawnFires fires={[
        { id: 'm1', name: 'Riley', fire: BURNING },
        { id: 'm2', name: 'Sasha', fire: EMBERS },
        { id: 'm3', name: 'Sam', fire: FROZEN },
      ]} />,
    );
    const rows = getAllByTestId('dawn-fire-row').map((r) => r.props.accessibilityLabel);
    expect(rows).toEqual([
      "Sam's froze. They let it freeze. Their standing paid.",
      "Sasha's fire is down to embers. Your turn.",
      "Riley's fire burns. Your turn.",
    ]);
  });

  it('says whose turn it is on a fire the other side answered last', () => {
    const theirTurn = fireOf(
      { status: 'Active', createdAt: at(1, 9), lastMessageAt: at(0, 9), lastMessageSenderId: MY_ID, messageCount: 5 },
      MY_ID, NOW, WINDOWS,
    );
    const { getByText } = render(<DawnFires fires={[{ id: 'm1', name: 'Riley', fire: theirTurn }]} />);
    expect(getByText("Riley's fire burns. Their turn.")).toBeTruthy();
  });

  it('marks each state the way the Quest Log does — flame, ember, ice', () => {
    const { getByTestId } = render(
      <DawnFires fires={[
        { id: 'm1', name: 'Riley', fire: BURNING },
        { id: 'm2', name: 'Sasha', fire: EMBERS },
        { id: 'm3', name: 'Sam', fire: FROZEN },
      ]} />,
    );
    expect(getByTestId('glyph-flame', HIDDEN)).toBeTruthy();
    expect(getByTestId('state-ember', HIDDEN)).toBeTruthy();
    expect(getByTestId('glyph-ice', HIDDEN)).toBeTruthy();
  });

  it('leaves an unlit thread out — nothing was lit, so nothing was judged', () => {
    const { queryAllByTestId, getByText } = render(
      <DawnFires fires={[{ id: 'm1', name: 'Riley', fire: UNLIT }]} />,
    );
    expect(queryAllByTestId('dawn-fire-row')).toHaveLength(0);
    expect(getByText('No fires yet. The road is where they start.')).toBeTruthy();
  });

  it('says so plainly when there is no fire at all', () => {
    const { getByText } = render(<DawnFires fires={[]} />);
    expect(getByText('No fires yet. The road is where they start.')).toBeTruthy();
  });

  it('opens the thread the row is about', () => {
    const { getAllByTestId } = render(
      <DawnFires fires={[{ id: 'm7', name: 'Riley', fire: BURNING }]} />,
    );
    fireEvent.press(getAllByTestId('dawn-fire-row')[0]);
    expect(mockPush).toHaveBeenCalledWith('/chat/m7');
  });
});
