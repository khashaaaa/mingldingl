import { romanNumeral } from '../numerals';

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
