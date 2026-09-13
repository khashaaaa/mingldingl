import { i18n } from './i18n';

/**
 * Time in the world's units (Sealed Fire move 13).
 *
 * A countdown is the most modern thing on every screen. These helpers turn "in 19h 6m" into
 * "tomorrow at 13:00" and "in 3 dawns", the way the streak already counts in dawns and the
 * festivals already run on a calendar. The exact clock is never removed — `WorldClock` shows it
 * on a tap — and Mongolian keeps the exact clock outright until the translator's lines land.
 */
export type WorldWhen =
  | { kind: 'passed' }
  | { kind: 'candle'; minutes: number }
  | { kind: 'today'; time: string }
  | { kind: 'tomorrow'; time: string }
  | { kind: 'dawns'; dawns: number };

const HOUR_MS = 60 * 60 * 1000;

/** Local calendar day as a whole number, so two instants compare by the midnights between them. */
function localDayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / (24 * HOUR_MS));
}

function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function worldWhen(targetIso: string | null, nowMs: number): WorldWhen {
  if (!targetIso) return { kind: 'passed' };
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target) || target <= nowMs) return { kind: 'passed' };
  const diff = target - nowMs;
  if (diff < HOUR_MS) return { kind: 'candle', minutes: Math.max(1, Math.floor(diff / 60000)) };
  const dawns = localDayIndex(target) - localDayIndex(nowMs);
  if (dawns <= 0) return { kind: 'today', time: clockTime(target) };
  if (dawns === 1) return { kind: 'tomorrow', time: clockTime(target) };
  return { kind: 'dawns', dawns };
}

export function worldWhenText(when: WorldWhen): string {
  switch (when.kind) {
    // `countdown_any_moment` is a line on its own ("Any moment"); this one is a fragment dropped
    // into "Gates close %{when}.", so it has to be lowercase or the sentence breaks in half.
    case 'passed': return i18n.t('when_passed');
    case 'candle': return i18n.t('when_candle');
    case 'today': return i18n.t('when_today', { time: when.time });
    case 'tomorrow': return i18n.t('when_tomorrow', { time: when.time });
    case 'dawns': return i18n.t('when_dawns', { count: when.dawns });
  }
}

/**
 * The world's phrases exist in English only for now. Rendering them inside a Mongolian sentence
 * would mix languages mid-line, so `mn` keeps the exact countdown it already has.
 */
export function worldTimeSpoken(): boolean {
  return i18n.locale === 'en';
}

/** How far an ordinal is still a word. A month, because the longest run this app counts in
 *  ordinals is a run of dawns — the hearth's "the fourteenth dawn" — and a person reads a date
 *  within the month as a word and anything past it as a number. It stopped at twelve first, which
 *  put "The 14th dawn" on the hearth beside "the fourteenth day" everywhere else. */
const ORDINAL_WORDS_TO = 31;

/** An ordinal in words to the thirty-first, a suffixed numeral beyond ("32nd", "111th"). Localised
 *  through `ordinal_N` rather than assembled here, because the words are copy: Mongolian does not
 *  build "twenty-first" out of "twenty" and "first" the way English does. */
export function ordinalWord(n: number): string {
  if (n >= 1 && n <= ORDINAL_WORDS_TO) return i18n.t(`ordinal_${n}`);
  const rem100 = n % 100;
  const rem10 = n % 10;
  const suffix = rem100 >= 11 && rem100 <= 13 ? 'th' : rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** A small count in words, one through twelve, falling back to the numeral beyond — the fire's
 *  dawn counts read as prose ("Two dawns of silence"), not a digit dropped into a sentence.
 *
 *  Deliberately shorter than `ordinalWord`'s reach: an ordinal names a day within a month and is
 *  read as a word that far, while a *count* of twenty-seven dawns is a quantity, and a quantity
 *  past a dozen is clearer as a numeral. The two ranges are not meant to match. */
export function countWord(n: number): string {
  if (n >= 1 && n <= 12) return i18n.t(`count_${n}`);
  return String(n);
}

/** Which day of a thread an instant falls on, counting local midnights since the thread began. */
export function threadDay(iso: string, threadStartIso: string): number {
  const day = localDayIndex(new Date(iso).getTime()) - localDayIndex(new Date(threadStartIso).getTime()) + 1;
  return Math.max(1, day);
}
