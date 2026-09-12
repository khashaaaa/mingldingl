import { render, fireEvent, act } from '@testing-library/react-native';
import { WorldClock } from '../WorldClock';
import { i18n } from '../../../lib/i18n';

/**
 * Move 13: a countdown speaks the world's units first ("tomorrow at 13:00") and only bares the
 * exact clock on a tap — for four seconds, then it reverts. Mongolian has no translated world
 * phrases yet, so it stays on the exact clock outright (worldTimeSpoken()).
 */
describe('WorldClock', () => {
  const originalLocale = i18n.locale;

  afterEach(() => {
    i18n.locale = originalLocale;
    jest.useRealTimers();
  });

  const now = new Date(2026, 8, 12, 9, 0).getTime();
  const target = new Date(2026, 8, 13, 13, 0).toISOString();

  it('speaks the world in English and shows the clock itself on a tap, then returns', () => {
    jest.useFakeTimers();
    i18n.locale = 'en';
    const { getByText, getByRole } = render(
      <WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />,
    );
    expect(getByText('The first bell rings tomorrow at 13:00.')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(getByText('Starts in 1d 4h')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getByText('The first bell rings tomorrow at 13:00.')).toBeTruthy();
  });

  it('keeps the exact clock for Mongolian', () => {
    i18n.locale = 'mn';
    const { queryByText } = render(
      <WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />,
    );
    expect(queryByText(/first bell/)).toBeNull();
  });

  it('carries both the world phrase and the exact clock in its accessibility label', () => {
    i18n.locale = 'en';
    const { getByRole } = render(
      <WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe(
      'The first bell rings tomorrow at 13:00. Starts in 1d 4h',
    );
  });

  it('clears its revert timer on unmount rather than firing setState after teardown', () => {
    jest.useFakeTimers();
    i18n.locale = 'en';
    const { getByRole, unmount } = render(
      <WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />,
    );
    fireEvent.press(getByRole('button'));
    unmount();
    expect(() => act(() => { jest.advanceTimersByTime(4000); })).not.toThrow();
  });
});
