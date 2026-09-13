/**
 * Roman numerals for the Hall of Names (`app/leaderboard.tsx`). The board is anonymous — no
 * display names come back from the engine — so a rank is the only thing carved into a row, and
 * it is carved the way a wall actually would be: no Arabic digits.
 *
 * 1..3999 is the full range a standard (non-vinculum) numeral can express. Outside it — including
 * a non-integer, which has no numeral at all — is a caller error, not a rank to render silently
 * wrong.
 */
const NUMERALS: readonly (readonly [number, string])[] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function romanNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(`romanNumeral: ${n} is outside 1..3999`);
  }
  let remaining = n;
  let result = '';
  for (const [value, symbol] of NUMERALS) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}
