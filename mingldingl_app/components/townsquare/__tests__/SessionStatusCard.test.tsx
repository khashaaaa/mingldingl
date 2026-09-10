import { render, fireEvent } from '@testing-library/react-native';
import { SessionStatusCard } from '../SessionStatusCard';
import type { TownSquareNextSession } from '../../../hooks/useTownSquareSession';
import { useActiveFestival } from '../../../lib/festivals';

jest.mock('../../../lib/festivals', () => ({ useActiveFestival: jest.fn() }));
const mockFestival = useActiveFestival as jest.Mock;
const NAADAM = { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: '#E0561F', start: '2026-07-11', end: '2026-07-13' };

const NOW = new Date('2026-08-14T10:00:00Z').getTime();

function openSession(overrides: Partial<TownSquareNextSession> = {}): TownSquareNextSession {
  return {
    sessionId: 's1',
    rsvpOpensAt: '2026-08-13T10:00:00Z',
    rsvpClosesAt: '2026-08-14T18:00:00Z',
    scheduledStartAt: '2026-08-14T20:00:00Z',
    status: 'Open',
    isRsvpd: false,
    ...overrides,
  };
}

describe('SessionStatusCard', () => {
  beforeEach(() => mockFestival.mockReturnValue(null));

  it('renders an empty state when there is no upcoming session', () => {
    const { getByText } = render(
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/The square stands quiet/i)).toBeTruthy();
  });

  it('shows an RSVP button and calls onRsvp with the session id when not yet RSVP\'d', () => {
    const onRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={onRsvp} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/^RSVP$/i));
    expect(onRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows a Cancel RSVP button and calls onCancelRsvp when already RSVP\'d', () => {
    const onCancelRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession({ isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={onCancelRsvp} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/Cancel RSVP/i));
    expect(onCancelRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows the RSVP countdown for an Open session', () => {
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/8h 0m/)).toBeTruthy();
  });

  it('hides the RSVP button once the roster is Locked', () => {
    const { queryByText } = render(
      <SessionStatusCard session={openSession({ status: 'Locked', isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByText(/^RSVP$/i)).toBeNull();
    expect(queryByText(/Cancel RSVP/i)).toBeNull();
  });

  it('offers a way back into an in-progress session the user is RSVP\'d to', () => {
    const onEnter = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession({ status: 'InProgress', isRsvpd: true })} now={NOW}
        onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={onEnter} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/gathering is under way/i)).toBeTruthy();
    fireEvent.press(getByText(/Return to the Square/i));
    expect(onEnter).toHaveBeenCalledWith('s1');
  });

  it('does not offer entry to an in-progress session the user never joined', () => {
    const { getByText, queryByText } = render(
      <SessionStatusCard session={openSession({ status: 'InProgress', isRsvpd: false })} now={NOW}
        onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/gathering is under way/i)).toBeTruthy();
    expect(queryByText(/Return to the Square/i)).toBeNull();
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
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} onEnter={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByTestId('festival-eyebrow')).toBeNull();
  });
});
