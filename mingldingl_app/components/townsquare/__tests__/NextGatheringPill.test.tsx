import { render, fireEvent, act } from '@testing-library/react-native';
import { NextGatheringPill } from '../NextGatheringPill';
import type { TownSquareNextSession } from '../../../hooks/useTownSquareSession';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUseTownSquareSession = jest.fn();
jest.mock('../../../hooks/useTownSquareSession', () => ({
  useTownSquareSession: () => mockUseTownSquareSession(),
}));

const NOW = new Date('2026-08-14T10:00:00Z').getTime();

function session(overrides: Partial<TownSquareNextSession> = {}): TownSquareNextSession {
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

  it('shows the RSVP-closes countdown for an open session and ticks each second', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session() });
    const { getByText, queryByTestId } = render(<NextGatheringPill />);
    expect(getByText('Gathering · RSVP closes in 2h 30m')).toBeTruthy();
    expect(queryByTestId('next-gathering-rsvpd')).toBeNull();

    act(() => { jest.advanceTimersByTime(60 * 1000); });
    expect(getByText('Gathering · RSVP closes in 2h 29m')).toBeTruthy();
  });

  it('counts down to the start once RSVP has closed', () => {
    mockUseTownSquareSession.mockReturnValue({ session: session({ status: 'Locked' }) });
    const { getByText } = render(<NextGatheringPill />);
    expect(getByText('Gathering in 10h 0m')).toBeTruthy();
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
