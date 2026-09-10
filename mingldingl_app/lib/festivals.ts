import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { COLORS } from './theme';
import { TIER_COLORS } from './tiers';

export interface FestivalWindow {
  key: string;
  nameKey: string;
  icon: 'bow-arrow' | 'moon-full';
  color: string;
  start: string;
  end: string;
}

export const FESTIVALS: FestivalWindow[] = [
  { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2026-07-11', end: '2026-07-13' },
  { key: 'naadam-2027', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2027-07-11', end: '2027-07-13' },
  { key: 'naadam-2028', nameKey: 'festival_naadam', icon: 'bow-arrow', color: COLORS.ember, start: '2028-07-11', end: '2028-07-13' },
  { key: 'tsagaan-sar-2027', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2027-02-06', end: '2027-02-08' },
  { key: 'tsagaan-sar-2028', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2028-02-24', end: '2028-02-26' },
  { key: 'tsagaan-sar-2029', nameKey: 'festival_tsagaan_sar', icon: 'moon-full', color: TIER_COLORS.Opal, start: '2029-02-13', end: '2029-02-15' },
];

export function activeFestival(now: Date = new Date()): FestivalWindow | null {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  return FESTIVALS.find((f) => iso >= f.start && iso <= f.end) ?? null;
}

// The festival window is a calendar fact, so a screen left open across midnight (or resumed from
// the background days later) must not keep painting yesterday's answer. Re-evaluated on mount and
// each time the app returns to the foreground; `activeFestival` itself stays pure.
export function useActiveFestival(): FestivalWindow | null {
  const [festival, setFestival] = useState<FestivalWindow | null>(() => activeFestival());
  useEffect(() => {
    setFestival(activeFestival());
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') setFestival(activeFestival());
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
  return festival;
}
