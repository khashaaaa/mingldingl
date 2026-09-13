import { render, fireEvent, act } from '@testing-library/react-native';
import { NextGatheringPill } from '../NextGatheringPill';
import type { TownSquareNextSession } from '../../../hooks/useTownSquareSession';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUseTownSquareSession = jest.fn();
jest.mock('../../../hooks/useTownSquareSession', () => ({
  useTownSquareSession: () => mockUseTownSquareSession(),
}));

// The world's phrasing ("today at 20:30") is read off the *local* calendar, so every instant here
// is built from local components rather than a UTC literal: a fixture pinned to `Z` says a
// different wall-clock hour in CI (UTC) than on this machine, and the assertions below went red
// there while staying green here.
const NOW = new Date(2026, 7, 14, 18, 0).getTime();

function session(overrides: Partial<TownSquareNextSession> = {}): TownSquareNextSession {
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

describe('NextGatheringPill', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockPush.mockClear();
    mockUseTownSquareSession.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when there is no upcoming session', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session({ sessionId: null, status: null }) });
    const { queryByTestId } = render(<NextGatheringPill />);
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });

  it('renders nothing while the session is still loading', () => {
    mockUseTownSquareSession.mockReturnValue({ session: undefined });
    const { queryByTestId } = render(<NextGatheringPill />);
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });

  it('shows the RSVP-closes countdown for an open session in the world\'s words, and ticks the exact clock in its accessibility label each second', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session() });
    const { getByText, getByTestId, queryByTestId } = render(<NextGatheringPill />);
    // The pill navigates on any tap, so there's no toggle here (unlike SessionStatusCard's
    // WorldClock) — the world's phrasing is what's on screen, and the exact number a screen
    // reader gets lives in the accessibility label instead.
    expect(getByText('Gates close today at 20:30.')).toBeTruthy();
    expect(getByTestId('next-gathering-pill').props.accessibilityLabel).toBe(
      'Gates close today at 20:30. Gathering · RSVP closes in 2h 30m',
    );
    expect(queryByTestId('next-gathering-rsvpd')).toBeNull();

    act(() => { jest.advanceTimersByTime(60 * 1000); });
    expect(getByTestId('next-gathering-pill').props.accessibilityLabel).toBe(
      'Gates close today at 20:30. Gathering · RSVP closes in 2h 29m',
    );
  });

  it('counts down to the start once RSVP has closed', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session({ status: 'Locked' }) });
    const { getByText, getByTestId } = render(<NextGatheringPill />);
    expect(getByText('The first bell rings tomorrow at 04:00.')).toBeTruthy();
    expect(getByTestId('next-gathering-pill').props.accessibilityLabel).toBe(
      'The first bell rings tomorrow at 04:00. Gathering in 10h 0m',
    );
  });

  it('shows the under-way copy while the session runs', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session({ status: 'InProgress' }) });
    const { getByText } = render(<NextGatheringPill />);
    expect(getByText('The gathering is under way')).toBeTruthy();
  });

  it('marks the pill when the user has RSVPd', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session({ isRsvpd: true }) });
    const { getByTestId } = render(<NextGatheringPill />);
    expect(getByTestId('next-gathering-rsvpd')).toBeTruthy();
  });

  it('navigates to the Town Square tab when pressed', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session() });
    const { getByTestId } = render(<NextGatheringPill />);
    fireEvent.press(getByTestId('next-gathering-pill'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/townsquare');
  });
});
