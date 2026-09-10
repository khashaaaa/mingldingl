import { useProfile } from './useProfile';
import { useScoreDetail } from './useScoreDetail';
import {
  SEVEN_DAWNS_NEEDED, THREAD_HONOUR_IDS, THREAD_HONOUR_NEEDED, type HonourId,
} from '../lib/tiers';

export interface HonourProgress {
  /** Capped at `needed`: a slot that is still dark with the deed already done is an engine lag, not a 9 of 7. */
  readonly held: number;
  readonly needed: number;
}

/**
 * How close each still-dark honour is, for the ones the app can actually count. The engine grants
 * honours; this only reads figures it already serves — the login streak, the oath's encounter
 * tally, sparked threads — so a slot can show "4 of 7" instead of only the deed. Honours with no
 * countable progress (Flame Rite, Seal-Breaker, Ally-Caller, True Word) are simply absent.
 */
export function useHonourProgress(): Partial<Record<HonourId, HonourProgress>> {
  const { data: score } = useScoreDetail();
  const { data: profile } = useProfile();

  const out: Partial<Record<HonourId, HonourProgress>> = {};

  if (score?.currentStreak != null) {
    out.title_sevendawns = clamp(score.currentStreak, SEVEN_DAWNS_NEEDED);
  }

  if (profile?.oath && profile.oathEncountersHeld != null && profile.oathEncountersNeeded != null && profile.oathEncountersNeeded > 0) {
    out.title_oathkeeper = clamp(profile.oathEncountersHeld, profile.oathEncountersNeeded);
  }

  if (score?.threadsSparked != null) {
    for (const id of THREAD_HONOUR_IDS) out[id] = clamp(score.threadsSparked, THREAD_HONOUR_NEEDED[id]);
  }

  return out;
}

function clamp(held: number, needed: number): HonourProgress {
  return { held: Math.max(0, Math.min(held, needed)), needed };
}
