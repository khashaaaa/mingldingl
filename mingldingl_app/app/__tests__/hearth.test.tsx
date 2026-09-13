import { fireEvent, render } from '@testing-library/react-native';
import HearthScreen from '../hearth';
import { useProfile } from '../../hooks/useProfile';
import { useMatches } from '../../hooks/useMatches';
import { useMyUserId } from '../../hooks/useMyUserId';
import { useMilestones } from '../../hooks/useMilestones';
import { useDailyMatchBudget } from '../../hooks/useScore';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { useActiveFestival } from '../../lib/festivals';
import { WithSafeArea } from '../../lib/testing/safeArea';

const mockPush = jest.fn();
// `usePathname` is what `HeaderBar` reads to drop the way-home tap on the hearth itself, so this
// screen's stub has to name the hearth's own route.
jest.mock('expo-router', () => ({ usePathname: () => '/hearth', useRouter: () => ({ push: mockPush }) }));

jest.mock('../../hooks/useProfile');
jest.mock('../../hooks/useMatches');
jest.mock('../../hooks/useMyUserId');
jest.mock('../../hooks/useMilestones');
jest.mock('../../hooks/useScore');
jest.mock('../../hooks/useTownSquareSession', () => ({ useTownSquareSession: jest.fn() }));
jest.mock('../../lib/festivals', () => ({
  ...jest.requireActual('../../lib/festivals'),
  useActiveFestival: jest.fn(),
}));

const mockUseProfile = useProfile as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseMyUserId = useMyUserId as jest.Mock;
const mockUseMilestones = useMilestones as jest.Mock;
const mockUseDailyMatchBudget = useDailyMatchBudget as jest.Mock;
const mockUseTownSquareSession = useTownSquareSession as jest.Mock;
const mockUseActiveFestival = useActiveFestival as jest.Mock;

/** Local components, and 10:00 so `dayPhase` reads `day` — no star, no horizon glow. */
const NOW = new Date(2026, 8, 13, 10);

/** Frost is decorative, so it is hidden from assistive tech and from the default queries with it. */
const HIDDEN = { includeHiddenElements: true };

function daysAgo(n: number): string {
  return new Date(2026, 8, 13 - n, 9).toISOString();
}

function renderScreen() {
  return render(<HearthScreen />, { wrapper: WithSafeArea });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Fake timers so neither `useNowTicker` nor the gathering pill's own second-hand fires between
  // renders, and `Date.now()` is the fixture instant rather than whenever the suite happens to run.
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockUseProfile.mockReturnValue({ data: { isProfileComplete: false, joinedAt: daysAgo(11) } });
  mockUseMatches.mockReturnValue({ data: [] });
  mockUseMyUserId.mockReturnValue('me');
  mockUseMilestones.mockReturnValue({ milestones: [], isLoading: false, open: jest.fn(), isOpening: false });
  mockUseDailyMatchBudget.mockReturnValue({ budget: 5, used: 2, remaining: 3 });
  mockUseTownSquareSession.mockReturnValue({
    session: {
      sessionId: 's1',
      status: 'Open',
      rsvpOpensAt: daysAgo(0),
      rsvpClosesAt: new Date(NOW.getTime() + 90 * 60 * 1000).toISOString(),
      scheduledStartAt: new Date(NOW.getTime() + 120 * 60 * 1000).toISOString(),
      isRsvpd: false,
      rsvpCount: 3,
      roundCount: 4,
    },
    isLoading: false,
  });
  mockUseActiveFestival.mockReturnValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the dawn the hearth counts', () => {
  it('names the dawn in words while the count is still a word', () => {
    // Joined eleven local days ago, so today is the twelfth day of the thread with the realm.
    const { getByText } = renderScreen();
    expect(getByText('THE TWELFTH DAWN')).toBeTruthy();
  });

  it('falls back to the numeral past the twelfth, the way `ordinalWord` always has', () => {
    mockUseProfile.mockReturnValue({ data: { isProfileComplete: false, joinedAt: daysAgo(13) } });
    const { getByText } = renderScreen();
    expect(getByText('THE 14TH DAWN')).toBeTruthy();
  });

  it('says only that it is a new dawn when the joining day is unknown', () => {
    mockUseProfile.mockReturnValue({ data: { isProfileComplete: false } });
    const { getByText } = renderScreen();
    expect(getByText('A NEW DAWN')).toBeTruthy();
  });
});

describe('the window and the wax', () => {
  it('shows the sky at the hour it actually is, and says what the sky is doing', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('sky-window').props.accessibilityLabel).toBe('Day.');
    expect(getByText(/The sky over the hearth is the real sky\./)).toBeTruthy();
  });

  it('draws the day’s summons as candle stubs, three of five still lit', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('3 of 5 candles left')).toBeTruthy();
  });

  it('states the law of the wax under the row', () => {
    const { getByText } = renderScreen();
    expect(getByText('Each summons burns one. The frost takes nothing; only silence does.')).toBeTruthy();
  });

  it('turns the window to frost and speaks of the White Moon for the three days', () => {
    mockUseActiveFestival.mockReturnValue({
      key: 'tsagaan-sar-2027', nameKey: 'festival_tsagaan_sar', icon: 'moon-full',
      color: '#10C0AC', start: '2027-02-06', end: '2027-02-08',
    });
    const { getByText, queryByText, getByTestId } = renderScreen();
    expect(getByTestId('frost-edge-top', HIDDEN)).toBeTruthy();
    expect(getByText('WHITE MOON')).toBeTruthy();
    expect(getByText(/Frost on the window, snow past the door\./)).toBeTruthy();
    // The White Moon's own two lines stand in place of the sky sentence, not on top of it.
    expect(queryByText(/The sky over the hearth is the real sky\./)).toBeNull();
  });
});

describe('the destinations', () => {
  const ROUTES: [string, string][] = [
    ['destination-fire', '/(tabs)/discover'],
    ['destination-letters', '/(tabs)/matches'],
    ['destination-square', '/(tabs)/townsquare'],
    ['destination-forge', '/(tabs)/activity'],
    ['destination-mirror', '/(tabs)/profile'],
  ];

  it.each(ROUTES)('sends %s to %s', (testID, route) => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId(testID));
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it('carries the Satchel too, quieter than the five', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('destination-satchel'));
    expect(mockPush).toHaveBeenCalledWith('/satchel');
  });

  it('names each row for a screen reader', () => {
    const { getByTestId } = renderScreen();
    const fire = getByTestId('destination-fire');
    expect(fire.props.accessibilityRole).toBe('button');
    expect(fire.props.accessibilityLabel).toBe('The Fire');
  });
});

describe('what moved here', () => {
  it('holds the First Steps board, moved off the character sheet', () => {
    const { getByText } = renderScreen();
    expect(getByText('FIRST STEPS')).toBeTruthy();
  });

  it('lets the First Steps board go once every step is done, as it always did', () => {
    mockUseMilestones.mockReturnValue({
      milestones: [
        { id: 'first_match', achievedAt: '2026-01-01' },
        { id: 'first_icebreaker', achievedAt: '2026-01-01' },
        { id: 'first_quiz', achievedAt: '2026-01-01' },
      ],
      isLoading: false,
      open: jest.fn(),
      isOpening: false,
    });
    mockUseProfile.mockReturnValue({ data: { isProfileComplete: true, joinedAt: daysAgo(11) } });
    const { queryByText } = renderScreen();
    expect(queryByText('FIRST STEPS')).toBeNull();
  });

  it('holds the next gathering’s pill, moved off the Quest Log', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('next-gathering-pill')).toBeTruthy();
  });

  it('draws no wax at all while the day’s ration is unknown', () => {
    // The budget meter this replaced held the same rule: an unknown budget shows nothing rather
    // than a row of nought candles, which would read as "all spent".
    mockUseDailyMatchBudget.mockReturnValue(null);
    const { queryByTestId, queryByText } = renderScreen();
    expect(queryByTestId('candle-row')).toBeNull();
    expect(queryByText(/Each summons burns one\./)).toBeNull();
  });
});

describe('the fires judged at this dawn', () => {
  it('heads the ledger and says there is nothing in it yet', () => {
    const { getByText } = renderScreen();
    expect(getByText('JUDGED AT THIS DAWN')).toBeTruthy();
    expect(getByText('No fires yet. The road is where they start.')).toBeTruthy();
  });

  it('draws a row per lit fire, named as the thread names them', () => {
    mockUseMatches.mockReturnValue({
      data: [{
        matchId: 'm1',
        otherUserId: 'u2',
        status: 'Active',
        revealLevel: 2,
        messageCount: 4,
        icebreakerComplete: false,
        videoCallUnlocked: false,
        otherUser: { displayName: 'Riley' },
        flameRiteDurationMinutes: 5,
        flameRiteRequired: false,
        videoEnabled: true,
        createdAt: daysAgo(2),
        lastMessageAt: daysAgo(0),
        lastMessageSenderId: 'u2',
      }],
    });
    const { getByText } = renderScreen();
    expect(getByText("Riley's fire burns. Your turn.")).toBeTruthy();
  });

  it('keeps a sealed thread sealed — the fire is named for the seal, not the person', () => {
    mockUseMatches.mockReturnValue({
      data: [{
        matchId: 'm1',
        otherUserId: 'u2',
        status: 'Active',
        revealLevel: 1,
        messageCount: 1,
        icebreakerComplete: false,
        videoCallUnlocked: false,
        otherUser: { displayName: 'Riley' },
        flameRiteDurationMinutes: 5,
        flameRiteRequired: false,
        videoEnabled: true,
        createdAt: daysAgo(2),
        lastMessageAt: daysAgo(0),
        lastMessageSenderId: 'u2',
      }],
    });
    const { getByText, queryByText } = renderScreen();
    // `unknown_name`, not the Quest Log's `??? • Mystery` — a tile can wear a placeholder where a
    // name goes, but "??? • Mystery's fire burns." is not a sentence.
    expect(getByText("A sealed one's fire burns. Your turn.")).toBeTruthy();
    expect(queryByText(/Riley/)).toBeNull();
  });
});

describe('the law of the map', () => {
  it('states it at the foot of the screen', () => {
    const { getByText } = renderScreen();
    expect(getByText('A map, never a hallway. Nothing is reachable only from here.')).toBeTruthy();
  });
});
