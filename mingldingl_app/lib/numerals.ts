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

/**
 * The Hall's actual, display-safe rank numeral. `romanNumeral` stays strict on purpose — it is a
 * numeral converter, not a rank formatter, and the fix for one caller's edge case is not a reason
 * to let it start lying about numbers it can't represent.
 *
 * A rank, unlike a numeral, has no ceiling: it is a user's real standing across a whole city, and
 * `app/leaderboard.tsx` renders it for the detached own row past `TOP_SLICE_SIZE` however large it
 * is. Before `TorchGlow`/the Hall existed that just printed `#5000`; routing it through the strict
 * `romanNumeral` instead throws inside `renderItem`, which the app's `ErrorBoundary` turns into an
 * error screen for exactly the person checking her own standing. This falls back to Arabic digits
 * past the numeral's range, and to an em dash for a rank that isn't a usable number at all — a
 * placeholder never a crash.
 */
export function rankNumeral(n: number): string {
  if (Number.isInteger(n) && n >= 1 && n <= 3999) return romanNumeral(n);
  if (Number.isFinite(n)) return n.toLocaleString();
  return '—';
}
