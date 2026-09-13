import { render, fireEvent } from '@testing-library/react-native';
import { SessionStatusCard } from '../SessionStatusCard';
import type { TownSquareNextSession } from '../../../hooks/useTownSquareSession';
import { useActiveFestival } from '../../../lib/festivals';

jest.mock('../../../lib/festivals', () => ({ useActiveFestival: jest.fn() }));
const mockFestival = useActiveFestival as jest.Mock;
const NAADAM = { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: '#E0561F', start: '2026-07-11', end: '2026-07-13' };

// Built from local components, not UTC literals: `WorldClock` phrases an instant against the
// local calendar, so a `Z` fixture reads as a different wall-clock hour in CI (UTC) than here and
// the "tomorrow at 02:00" assertion below only passed at UTC+8.
const NOW = new Date(2026, 7, 14, 18, 0).getTime();

function openSession(overrides: Partial<TownSquareNextSession> = {}): TownSquareNextSession {
  return {
    sessionId: 's1',
    rsvpOpensAt: new Date(2026, 7, 13, 18, 0).toISOString(),
    rsvpClosesAt: new Date(2026, 7, 15, 2, 0).toISOString(),
    scheduledStartAt: new Date(2026, 7, 15, 4, 0).toISOString(),
    status: 'Open',
    isRsvpd: false,
    rsvpCount: 0,
    roundCount: 0,
    ...overrides,
  };
}

describe('SessionStatusCard', () => {
  beforeEach(() => mockFestival.mockReturnValue(null));

  it('renders an empty state when there is no upcoming session', () => {
    const { getByText } = render(
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false, rsvpCount: 0, roundCount: 0 }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/The square stands quiet/i)).toBeTruthy();
  });

  it('shows a "Light it" button and calls onRsvp with the session id when not yet RSVP\'d', () => {
    const onRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={onRsvp} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/^Light it$/i));
    expect(onRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows a "Put out" button and calls onCancelRsvp when already RSVP\'d', () => {
    const onCancelRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession({ isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={onCancelRsvp} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/^Put out$/i));
    expect(onCancelRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows the RSVP countdown for an Open session, in the world\'s words by default and the exact clock on a tap', () => {
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    const clock = getByText('Gates close tomorrow at 02:00.');
    fireEvent.press(clock);
    expect(getByText(/8h 0m/)).toBeTruthy();
  });

  it('hides the RSVP button once the roster is Locked', () => {
    const { queryByText } = render(
      <SessionStatusCard session={openSession({ status: 'Locked', isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByText(/^Light it$/i)).toBeNull();
    expect(queryByText(/^Put out$/i)).toBeNull();
  });

  it('bars the plaza\'s gates once the roster is Locked, and names the shut state in the sub line', () => {
    const { getAllByTestId, getByText } = render(
      <SessionStatusCard session={openSession({ status: 'Locked', isRsvpd: true, rsvpCount: 4 })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getAllByTestId('plaza-gate-bar', { includeHiddenElements: true })).toHaveLength(2);
    expect(getByText('The gates are shut. 4 lanterns lit. The first bell is near.')).toBeTruthy();
  });

  it('offers a way back into an in-progress session the user is RSVP\'d to', () => {
    const onEnter = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession({ status: 'InProgress', isRsvpd: true })} now={NOW}
        onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={onEnter} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/bells are ringing without you/i)).toBeTruthy();
    fireEvent.press(getByText(/^Return$/i));
    expect(onEnter).toHaveBeenCalledWith('s1');
  });

  it('does not offer entry to an in-progress session the user never joined', () => {
    const { getByText, queryByText } = render(
      <SessionStatusCard session={openSession({ status: 'InProgress', isRsvpd: false })} now={NOW}
        onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/bells are ringing without you/i)).toBeTruthy();
    expect(queryByText(/^Return$/i)).toBeNull();
  });

  it('is the screen\'s one hero card, drawing the plaza and naming the open state in the sub line', () => {
    const { getByTestId, getByText } = render(
      <SessionStatusCard session={openSession({ rsvpCount: 3, isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByTestId('plaza')).toBeTruthy();
    expect(getByText('Gates close at the lantern-lighting. 3 lanterns lit so far, yours among them.')).toBeTruthy();
  });

  it('names the not-mine sub line when the viewer has not lit a lantern', () => {
    const { getByText } = render(
      <SessionStatusCard session={openSession({ rsvpCount: 2, isRsvpd: false })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText('Gates close at the lantern-lighting. 2 lanterns lit so far.')).toBeTruthy();
  });

  it('shows the first-bell stat but no rounds row while the gates are Open (roundCount is only MaxPerSide, not a real count yet)', () => {
    const { getByText, queryByText } = render(
      <SessionStatusCard session={openSession({ roundCount: 6 })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText('FIRST BELL')).toBeTruthy();
    expect(queryByText('ROUNDS')).toBeNull();
    expect(queryByText('6, a bell each')).toBeNull();
  });

  it('shows the rounds stat row once the roster is Locked (the count is real from here on)', () => {
    const { getByText } = render(
      <SessionStatusCard session={openSession({ status: 'Locked', isRsvpd: true, roundCount: 6 })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText('FIRST BELL')).toBeTruthy();
    expect(getByText('ROUNDS')).toBeTruthy();
    expect(getByText('6, a bell each')).toBeTruthy();
  });

  it('names the empty state through a shut door, not a bank', () => {
    const { getByTestId } = render(
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false, rsvpCount: 0, roundCount: 0 }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByTestId('state-place-door', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows no festival eyebrow on an ordinary day', () => {
    const { queryByTestId } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByTestId('festival-eyebrow')).toBeNull();
  });

  it('names the festival above the title when one is on and a session exists', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { getByTestId, getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByTestId('festival-eyebrow')).toBeTruthy();
    expect(getByText('NAADAM TRIALS GATHERING')).toBeTruthy();
  });

  it('keeps the festival eyebrow on an in-progress session too', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { getByText } = render(
      <SessionStatusCard session={openSession({ status: 'InProgress', isRsvpd: true })} now={NOW}
        onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText('NAADAM TRIALS GATHERING')).toBeTruthy();
  });

  it('does not show the festival eyebrow when there is no session', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { queryByTestId } = render(
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false, rsvpCount: 0, roundCount: 0 }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByTestId('festival-eyebrow')).toBeNull();
  });
});
