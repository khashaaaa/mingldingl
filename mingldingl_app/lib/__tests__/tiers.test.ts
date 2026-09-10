import { TIER_ORDER, presenceForTier } from '../tiers';
import { TIER_PRESENCE } from '../theme';

/**
 * `TIER_PRESENCE` was defined, tested and read by nothing for weeks — the badge kept its own
 * `tierIndex >= 3` cliff, so rank was rendered as two rungs instead of six and no test noticed.
 * These assertions are on the function the badge actually calls.
 */
describe('presenceForTier', () => {
  const HERO = 44;

  it('climbs monotonically across the whole ladder at hero size', () => {
    const ramp = TIER_ORDER.map((t) => presenceForTier(t, HERO));
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].glowStrength).toBeGreaterThan(ramp[i - 1].glowStrength);
      expect(ramp[i].ringWidth).toBeGreaterThanOrEqual(ramp[i - 1].ringWidth);
      expect(ramp[i].shimmer).toBeGreaterThan(ramp[i - 1].shimmer);
    }
  });

  it('leaves the bottom rung with nothing to outrank and the top rung at full strength', () => {
    expect(presenceForTier(TIER_ORDER[0], HERO).glowStrength).toBe(0);
    expect(presenceForTier(TIER_ORDER[0], HERO).shimmer).toBe(0);
    expect(presenceForTier(TIER_ORDER[TIER_ORDER.length - 1], HERO).glowStrength).toBe(1);
  });

  it('never scales the ceiling: the top tier keeps the glow that shipped before the ramp', () => {
    // Normalised against the table's own maximum, so re-tuning a middle row cannot brighten
    // the hero badge past what the design was signed off at.
    const top = TIER_ORDER[TIER_ORDER.length - 1];
    expect(TIER_PRESENCE[top].glow).toBe(Math.max(...TIER_ORDER.map((t) => TIER_PRESENCE[t].glow)));
  });

  it('clamps the ring on badges too small to carry one', () => {
    // 16px is the ScoreHUD/XPBar badge; a 3px bezel there is a filled diamond, not a rank.
    for (const tier of TIER_ORDER) {
      expect(presenceForTier(tier, 16).ringWidth).toBe(1);
    }
    expect(presenceForTier('Emerald', 44).ringWidth).toBeGreaterThan(1);
  });

  it('drops the shimmer below the size where a sweep has room to travel', () => {
    expect(presenceForTier('Emerald', 20).shimmer).toBe(0);
    expect(presenceForTier('Emerald', 32).shimmer).toBeGreaterThan(0);
  });

  it('falls back to the bottom rung for a tier the ladder has never heard of', () => {
    expect(presenceForTier('Kryptonite', HERO)).toEqual(presenceForTier(TIER_ORDER[0], HERO));
  });
});
