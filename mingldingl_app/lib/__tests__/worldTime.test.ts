import { i18n } from '../i18n';
import { ordinalWord, threadDay, worldWhen, worldWhenText, worldTimeSpoken } from '../worldTime';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('worldWhen', () => {
  const now = at(2026, 9, 12, 9, 0);
  it('is passed at or before now', () => {
    expect(worldWhen(iso(now), now)).toEqual({ kind: 'passed' });
    expect(worldWhen(null, now)).toEqual({ kind: 'passed' });
  });
  it('is a candle under an hour away', () => {
    expect(worldWhen(iso(at(2026, 9, 12, 9, 40)), now)).toEqual({ kind: 'candle', minutes: 40 });
  });
  it('is today at a clock time an hour or more away on the same local day', () => {
    expect(worldWhen(iso(at(2026, 9, 12, 21, 5)), now)).toEqual({ kind: 'today', time: '21:05' });
  });
  it('is tomorrow across one local midnight, however few hours away', () => {
    expect(worldWhen(iso(at(2026, 9, 13, 1, 0)), at(2026, 9, 12, 23, 30))).toEqual({ kind: 'tomorrow', time: '01:00' });
  });
  it('counts dawns across two or more midnights', () => {
    expect(worldWhen(iso(at(2026, 9, 15, 20, 0)), now)).toEqual({ kind: 'dawns', dawns: 3 });
  });
});

describe('worldWhenText', () => {
  const originalLocale = i18n.locale;
  afterEach(() => { i18n.locale = originalLocale; });
  it('speaks each rung', () => {
    i18n.locale = 'en';
    expect(worldWhenText({ kind: 'passed' })).toBe('Any moment');
    expect(worldWhenText({ kind: 'candle', minutes: 7 })).toBe('before this candle burns down');
    expect(worldWhenText({ kind: 'today', time: '21:05' })).toBe('today at 21:05');
    expect(worldWhenText({ kind: 'tomorrow', time: '01:00' })).toBe('tomorrow at 01:00');
    expect(worldWhenText({ kind: 'dawns', dawns: 3 })).toBe('in 3 dawns');
  });
  it('is only spoken in English until the translator delivers', () => {
    i18n.locale = 'en';
    expect(worldTimeSpoken()).toBe(true);
    i18n.locale = 'mn';
    expect(worldTimeSpoken()).toBe(false);
  });
});

describe('ordinalWord', () => {
  it('uses words to twelve and suffixed numerals beyond', () => {
    expect(ordinalWord(1)).toBe('first');
    expect(ordinalWord(3)).toBe('third');
    expect(ordinalWord(12)).toBe('twelfth');
    expect(ordinalWord(13)).toBe('13th');
    expect(ordinalWord(21)).toBe('21st');
    expect(ordinalWord(22)).toBe('22nd');
    expect(ordinalWord(23)).toBe('23rd');
    expect(ordinalWord(111)).toBe('111th');
    expect(ordinalWord(112)).toBe('112th');
  });
});

describe('threadDay', () => {
  const start = iso(at(2026, 9, 10, 23, 50));
  it('is day one on the start day, day two after the first local midnight', () => {
    expect(threadDay(iso(at(2026, 9, 10, 23, 55)), start)).toBe(1);
    expect(threadDay(iso(at(2026, 9, 11, 0, 5)), start)).toBe(2);
    expect(threadDay(iso(at(2026, 9, 12, 12, 0)), start)).toBe(3);
  });
  it('never goes below one for a message that predates the start by clock skew', () => {
    expect(threadDay(iso(at(2026, 9, 10, 23, 40)), start)).toBe(1);
  });
});
