import { romanNumeral, rankNumeral } from '../numerals';

describe('romanNumeral', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
    [90, 'XC'],
    [400, 'CD'],
    [1994, 'MCMXCIV'],
    [3999, 'MMMCMXCIX'],
  ])('renders %i as %s', (n, expected) => {
    expect(romanNumeral(n)).toBe(expected);
  });

  it.each([0, -1, 4000, 1.5, NaN])('throws a RangeError outside 1..3999 (got %p)', (n) => {
    expect(() => romanNumeral(n)).toThrow(RangeError);
  });
});

describe('rankNumeral', () => {
  // A real rank has no ceiling (see app/leaderboard.tsx's detached own row), so unlike
  // romanNumeral this must never throw — it falls back instead of crashing the row.
  it('renders the Roman numeral inside 1..3999', () => {
    expect(rankNumeral(3999)).toBe('MMMCMXCIX');
  });

  it('falls back to Arabic digits past 3999 rather than throw', () => {
    expect(rankNumeral(4000)).toBe('4,000');
  });

  it('falls back to Arabic digits at 0 rather than throw', () => {
    expect(rankNumeral(0)).toBe('0');
  });

  it('falls back to an em dash for a rank that is not a usable number', () => {
    expect(rankNumeral(NaN)).toBe('—');
  });
});
