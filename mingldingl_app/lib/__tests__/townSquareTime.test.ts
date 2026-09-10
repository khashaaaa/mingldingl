import { formatCountdown } from '../townSquareTime';
import { i18n } from '../i18n';

describe('formatCountdown', () => {
  it('formats a target more than an hour away as "Xh Ym"', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    const target = '2026-08-14T12:30:00Z';
    expect(formatCountdown(target, now)).toBe('2h 30m');
  });

  it('rolls up to days once the gathering is more than a day out', () => {
    const now = new Date('2026-08-14T10:00:00Z').getTime();
    // Sessions are seeded and scheduled days ahead; in raw hours this read "216h 0m".
    expect(formatCountdown('2026-08-23T10:00:00Z', now)).toBe('9d 0h');
    expect(formatCountdown('2026-08-16T13:30:00Z', now)).toBe('2d 3h');
    // and the hour rung still owns everything under a day
    expect(formatCountdown('2026-08-15T09:59:00Z', now)).toBe('23h 59m');
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

  describe('under the mn locale', () => {
    const original = i18n.locale;
    beforeEach(() => { i18n.locale = 'mn'; });
    afterEach(() => { i18n.locale = original; });

    it('translates the units', () => {
      const now = new Date('2026-08-14T10:00:00Z').getTime();
      expect(formatCountdown('2026-08-14T12:30:00Z', now)).toBe('2ц 30м');
      expect(formatCountdown('2026-08-23T10:00:00Z', now)).toBe('9 өдөр 0ц');
      expect(formatCountdown('2026-08-14T10:05:30Z', now)).toBe('5м 30с');
      expect(formatCountdown('2026-08-14T10:00:45Z', now)).toBe('45с');
    });

    it('translates the elapsed case rather than falling back to English', () => {
      const now = new Date('2026-08-14T10:00:00Z').getTime();
      expect(formatCountdown('2026-08-14T09:59:00Z', now)).toBe('Тун удахгүй');
      expect(formatCountdown(null, now)).toBe('Тун удахгүй');
    });
  });
});
