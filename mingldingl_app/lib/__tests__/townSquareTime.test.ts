import { formatCountdown } from '../townSquareTime';

describe('formatCountdown', () => {
  it('formats a target more than an hour away as "Xh Ym"', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    const target = '2026-08-14T12:30:00Z';
    expect(formatCountdown(target, now)).toBe('2h 30m');
  });

  it('formats a target under an hour away as "Xm Ys"', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    const target = '2026-08-14T10:05:30Z';
    expect(formatCountdown(target, now)).toBe('5m 30s');
  });

  it('formats a target under a minute away as "Xs"', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    const target = '2026-08-14T10:00:45Z';
    expect(formatCountdown(target, now)).toBe('45s');
  });

  it('returns "Any moment" once the target has passed', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    const target = '2026-08-14T09:59:00Z';
    expect(formatCountdown(target, now)).toBe('Any moment');
  });

  it('returns "Any moment" for null', () => {
    expect(formatCountdown(null, Date.now())).toBe('Any moment');
  });
});
