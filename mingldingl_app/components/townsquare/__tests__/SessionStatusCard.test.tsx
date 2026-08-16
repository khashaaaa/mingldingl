import { render, fireEvent } from '@testing-library/react-native';
import { SessionStatusCard } from '../SessionStatusCard';
import type { TownSquareNextSession } from '../../../hooks/useTownSquareSession';

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
  it('renders an empty state when there is no upcoming session', () => {
    const { getByText } = render(
      <SessionStatusCard session={{ sessionId: null, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, status: null, isRsvpd: false }}
        now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/The square stands quiet/i)).toBeTruthy();
  });

  it('shows an RSVP button and calls onRsvp with the session id when not yet RSVP\'d', () => {
    const onRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={onRsvp} onCancelRsvp={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/^RSVP$/i));
    expect(onRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows a Cancel RSVP button and calls onCancelRsvp when already RSVP\'d', () => {
    const onCancelRsvp = jest.fn();
    const { getByText } = render(
      <SessionStatusCard session={openSession({ isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={onCancelRsvp} isRsvping={false} isCancelling={false} />,
    );
    fireEvent.press(getByText(/Cancel RSVP/i));
    expect(onCancelRsvp).toHaveBeenCalledWith('s1');
  });

  it('shows the RSVP countdown for an Open session', () => {
    const { getByText } = render(
      <SessionStatusCard session={openSession()} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(getByText(/8h 0m/)).toBeTruthy();
  });

  it('hides the RSVP button once the roster is Locked', () => {
    const { queryByText } = render(
      <SessionStatusCard session={openSession({ status: 'Locked', isRsvpd: true })} now={NOW} onRsvp={jest.fn()} onCancelRsvp={jest.fn()} isRsvping={false} isCancelling={false} />,
    );
    expect(queryByText(/^RSVP$/i)).toBeNull();
    expect(queryByText(/Cancel RSVP/i)).toBeNull();
  });
});
