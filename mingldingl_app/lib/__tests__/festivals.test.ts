import { activeFestival } from '../festivals';

// Constructed via the local Date(year, monthIndex, day, ...) form (not ISO
// strings) so these assertions hold regardless of the test runner's TZ —
// activeFestival reads local calendar date, on purpose (see festivals.ts).
describe('activeFestival', () => {
  it('returns Naadam inside its window, inclusive of both edges', () => {
    expect(activeFestival(new Date(2026, 6, 11, 0, 0))?.key).toBe('naadam-2026');
    expect(activeFestival(new Date(2026, 6, 12, 12, 0))?.key).toBe('naadam-2026');
    expect(activeFestival(new Date(2026, 6, 13, 23, 0))?.key).toBe('naadam-2026');
  });

  it('returns null just outside the Naadam window', () => {
    expect(activeFestival(new Date(2026, 6, 10, 23, 59))).toBeNull();
    expect(activeFestival(new Date(2026, 6, 14, 0, 0))).toBeNull();
  });

  it('returns Tsagaan Sar inside its 2027 window', () => {
    expect(activeFestival(new Date(2027, 1, 7, 0, 0))?.key).toBe('tsagaan-sar-2027');
  });

  it('returns null on an ordinary day', () => {
    expect(activeFestival(new Date(2026, 4, 1, 0, 0))).toBeNull();
  });
});
