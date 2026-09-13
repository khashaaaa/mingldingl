import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TownSquareScreen from '../townsquare';
import { useTownSquareSession } from '../../../hooks/useTownSquareSession';
import { WithSafeArea } from '../../../lib/testing/safeArea';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => '/test',
  useRouter: () => ({ push: mockPush }),
  // townsquare.tsx's own ticker is irrelevant to this test; run the effect once like `useEffect`
  // would, without a real navigation focus lifecycle.
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react').useEffect(effect, []);
  },
}));

// A bare `jest.mock(path)` automock still loads the real module first to learn its shape, which
// pulls in `lib/supabase` (a real client, built from env vars this test has no reason to set) —
// so this needs its own factory instead.
jest.mock('../../../hooks/useTownSquareSession', () => ({
  useTownSquareSession: jest.fn(),
}));
const mockUseSession = useTownSquareSession as jest.Mock;

// Local components, not UTC literals: the world's phrasing ("today at 20:30") is read off the
// local calendar, so a `Z` fixture names a different wall-clock hour in CI (UTC) than on a UTC+8
// machine and the sentence asserted below went red there.
function session(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 's1',
    rsvpOpensAt: new Date(2026, 7, 13, 18, 0).toISOString(),
    rsvpClosesAt: new Date(2026, 7, 14, 20, 30).toISOString(),
    scheduledStartAt: new Date(2026, 7, 15, 4, 0).toISOString(),
    status: 'Open',
    isRsvpd: false,
    rsvpCount: 0,
    roundCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 7, 14, 18, 0));
  mockPush.mockClear();
  mockUseSession.mockReset().mockReturnValue({
    session: session(),
    isError: false,
    error: null,
    refetch: jest.fn(),
    rsvp: jest.fn(),
    cancelRsvp: jest.fn(),
    isRsvping: false,
    isCancelling: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function renderScreen() {
  // GameHeader reads useScoreDetail (react-query) unconditionally, even though this screen
  // doesn't show the score HUD — it just needs a client in the tree.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <WithSafeArea>
      <QueryClientProvider client={client}>
        <TownSquareScreen />
      </QueryClientProvider>
    </WithSafeArea>,
  );
}

describe('TownSquareScreen chrome (task 7: the Square as a plaza)', () => {
  // The pill moved onto the hearth in task 5; the tab kept the import and the mount a task behind
  // its own move, so both had to go once the plaza gave this card somewhere to put the same
  // countdown itself.
  it('does not render the gathering pill — it lives on the hearth now', () => {
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });

  it('still shows the gates-close countdown on the session card, and the exact clock on a tap', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByText('Gates close today at 20:30.')).toBeTruthy();
    fireEvent.press(getByTestId('session-gates-close'));
    expect(getByText('RSVP closes in 2h 30m')).toBeTruthy();
  });

  it('draws the plaza for an open gathering', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('plaza')).toBeTruthy();
  });
});
