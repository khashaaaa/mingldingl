import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TownSquareScreen from '../townsquare';
import { useTownSquareSession } from '../../../hooks/useTownSquareSession';
import { WithSafeArea } from '../../../lib/testing/safeArea';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // townsquare.tsx's own ticker is irrelevant to this test; run the effect once like `useEffect`
  // would, without a real navigation focus lifecycle.
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react').useEffect(effect, []);
  },
}));

// Mocking the hook (rather than the API client) means the real `NextGatheringPill` renders below
// without ever reaching its own Supabase realtime wiring, which needs env config this test has no
// reason to provide — both it and the screen read the same mocked session.
// A bare `jest.mock(path)` automock still loads the real module first to learn its shape, which
// pulls in `lib/supabase` (a real client, built from env vars this test has no reason to set) —
// so this needs its own factory instead.
jest.mock('../../../hooks/useTownSquareSession', () => ({
  useTownSquareSession: jest.fn(),
}));
const mockUseSession = useTownSquareSession as jest.Mock;

function session(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 's1',
    rsvpOpensAt: '2026-08-13T10:00:00Z',
    rsvpClosesAt: '2026-08-14T12:30:00Z',
    scheduledStartAt: '2026-08-14T20:00:00Z',
    status: 'Open',
    isRsvpd: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-14T10:00:00Z'));
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

describe('TownSquareScreen chrome (task 8: moved from Seek)', () => {
  it('renders the gathering pill beside the session card, alongside its own countdown copy', () => {
    const { getByTestId, getByText, getAllByText } = renderScreen();
    expect(getByTestId('next-gathering-pill')).toBeTruthy();
    // SessionStatusCard already shows this same countdown — the pill sits beside it rather than
    // replacing it (task-8-report.md), so both copies coexist. Move 13: both now speak the
    // world's units by default and in the same words, since they share a worldKey; a tap on the
    // card's own clock (unlike the pill, which has no toggle — the whole thing navigates) still
    // bares the exact numbers the pill carries in its accessibility label.
    const worldClocks = getAllByText('Gates close today at 20:30.');
    expect(worldClocks).toHaveLength(2);
    fireEvent.press(worldClocks[0]);
    expect(getByText('RSVP closes in 2h 30m')).toBeTruthy();
    expect(getByTestId('next-gathering-pill').props.accessibilityLabel).toBe(
      'Gates close today at 20:30. Gathering · RSVP closes in 2h 30m',
    );
  });

  it('hides the pill when there is no upcoming session, same as it did on Seek', () => {
    mockUseSession.mockReturnValue({
      session: session({ sessionId: null, status: null }),
      isError: false,
      error: null,
      refetch: jest.fn(),
      rsvp: jest.fn(),
      cancelRsvp: jest.fn(),
      isRsvping: false,
      isCancelling: false,
    });
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });
});
