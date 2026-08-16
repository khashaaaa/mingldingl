import { COLORS } from './theme';
import { TIER_COLORS } from './tiers';

export interface FestivalWindow {
  key: string;
  nameKey: string;
  icon: 'bow-arrow' | 'moon-full';
  color: string;
  start: string; // YYYY-MM-DD, inclusive
  end: string;   // YYYY-MM-DD, inclusive
}

// Naadam: Mongolia's State Great Naadam Festival — a fixed national holiday
// (July 11-13 by law), unlike Tsagaan Sar this date never moves year to year.
//
// Tsagaan Sar: Mongolian Lunar New Year — follows the lunar calendar, so
// these are looked up per year rather than computed. Extend this table as
// each year approaches; sourced 2026-07-27 from
// https://www.qppstudio.net/global-holidays-observances/tsagaan-sar-mongolian-new-year.htm
// (2026's date already passed as of this writing, so it's intentionally
// omitted rather than guessed).
export const FESTIVALS: FestivalWindow[] = [
  { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2026-07-11', end: '2026-07-13' },
  { key: 'naadam-2027', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2027-07-11', end: '2027-07-13' },
  { key: 'naadam-2028', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2028-07-11', end: '2028-07-13' },
  { key: 'tsagaan-sar-2027', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2027-02-06', end: '2027-02-08' },
  { key: 'tsagaan-sar-2028', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2028-02-24', end: '2028-02-26' },
  { key: 'tsagaan-sar-2029', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2029-02-13', end: '2029-02-15' },
];

export function activeFestival(now: Date = new Date()): FestivalWindow | null {
  // Local calendar date, not UTC — these are Mongolia-local holidays, and
  // toISOString() would shift the window by the device's UTC offset (e.g.
  // starting/ending ~8h late for a device actually set to Mongolia time).
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  return FESTIVALS.find((f) => iso >= f.start && iso <= f.end) ?? null;
}
