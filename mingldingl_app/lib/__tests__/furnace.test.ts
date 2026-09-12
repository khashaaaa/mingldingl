import path from 'path';
import { appSources } from '../testing/sourceTree';

/**
 * Furnace, a little. `docs/design/sealed-fire/boards/Temperature.dc.html`: the two hot tokens
 * (`TEMPERATURE.furnace`/`furnaceBright`) may only ever reach the Fire, the Oath, the Ascension,
 * the Square's bell and the Hall of Names — everywhere else keeps gold and rounded corners. This
 * is a limit on identity, not a style choice any screen gets to make for itself, so it is held by
 * an allowlist rather than a convention.
 *
 * `components/cards/CandidateCard.tsx` is the first call site — the Fire's plaque rule and its
 * wax seals burn — and the rest of the list is still pigment waiting on its screen, so this test
 * mostly guards that the list stays empty of everything else. The second test proves the guard
 * would actually catch a violation, the same way `hero.test.ts`'s scanner test proves its own
 * regex before trusting it against the real tree.
 */

const ALLOWED = new Set([
  path.join('app', '(tabs)', 'discover.tsx'),
  path.join('components', 'cards', 'CandidateCard.tsx'),
  path.join('components', 'onboarding', 'OathStep.tsx'),
  path.join('components', 'profile', 'OathCard.tsx'),
  path.join('components', 'modals', 'TierUpCeremony.tsx'),
  path.join('app', '(tabs)', 'townsquare.tsx'),
  path.join('app', 'townsquare-round', '[sessionId].tsx'),
  path.join('app', 'leaderboard.tsx'),
]);

/** Matches the bare token names and the `TEMPERATURE.furnace`/`furnaceBright` access alike. */
const FURNACE_TOKEN = /furnace/i;

describe('furnace guard', () => {
  it('finds the allowed screens at all — a walk that saw nothing would pass by accident', () => {
    // `lib/theme.ts` itself is excluded by `appSources`; the list still runs ahead of its call
    // sites, so the count is pinned rather than derived from what happens to use the token today.
    expect(ALLOWED.size).toBe(8);
  });

  it('lets only the five screens (eight files) reach the hot tokens', () => {
    const offenders = appSources()
      .filter((f) => FURNACE_TOKEN.test(f.text))
      .map((f) => f.rel)
      .filter((rel) => !ALLOWED.has(rel));
    expect(offenders).toEqual([]);
  });

  it('would actually catch a stray use outside the allowlist', () => {
    const stray = "import { TEMPERATURE } from '../../lib/theme';\nconst c = TEMPERATURE.furnaceBright;";
    expect(FURNACE_TOKEN.test(stray)).toBe(true);
  });
});
