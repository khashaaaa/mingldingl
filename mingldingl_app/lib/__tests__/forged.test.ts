import path from 'path';
import { appSources, hasProp, openingTags } from '../testing/sourceTree';

/**
 * One forged button per screen.
 *
 * The kit's rule for actions is "one forged, the rest ink": the gold slab with the glow belongs to
 * the single deed a screen is *for*, and every other action is an underlined ink link. Eleven files
 * carried two or more — four of them on the icebreaker alone — which made the forge mean nothing:
 * a button style rather than a ranking. `ink` gave those secondary actions somewhere to go, and
 * this test is what stops a second forged button from appearing on a screen later.
 *
 * Counted per file, like `hero.test.ts`, and for the same reason: every component holding a
 * `GameButton` renders on exactly one screen, so a file is a screen's worth of action. Modals are
 * exempt — a modal is its own surface with its own one deed, and it is drawn over a screen that
 * already spent its forge. `components/settings/PhoneChangeModal.tsx` is a modal by role but not by
 * folder, and is held to the rule rather than moved; it costs it nothing.
 *
 * A tag with no `variant` counts: `primary` is the default, so the plainest call site in the app is
 * also the loudest button on it.
 */

const MODALS = path.join('components', 'modals') + path.sep;

/** The forged call sites in a file: explicitly `primary`, or primary by default. */
function forged(text: string) {
  return openingTags(text, 'GameButton').filter(
    (t) => !hasProp(t.props, 'variant') || /['"]primary['"]/.test(t.props),
  );
}

describe('what counts as forged', () => {
  it('counts the default, the explicit and the conditional — and no other metal', () => {
    const src = [
      '<GameButton onPress={go}>Default</GameButton>',
      '<GameButton variant="primary" onPress={go}>Explicit</GameButton>',
      "<GameButton variant={hot ? 'primary' : 'ghost'} onPress={go}>Conditional</GameButton>",
      '<GameButton variant="ghost" onPress={go}>Ghost</GameButton>',
      '<GameButton variant="ink" onPress={go}>Ink</GameButton>',
      "<GameButton variant={bad ? 'danger' : 'brass'} onPress={go}>Metal</GameButton>",
    ].join('\n');
    expect(forged(src).map((t) => t.line)).toEqual([1, 2, 3]);
  });
});

describe('one forged button per screen', () => {
  const screens = appSources()
    .filter((f) => f.rel.startsWith('app' + path.sep) || f.rel.startsWith('components' + path.sep))
    .filter((f) => !f.rel.startsWith(MODALS))
    .map((f) => ({ rel: f.rel, tags: openingTags(f.text, 'GameButton'), hot: forged(f.text) }))
    .filter((f) => f.tags.length > 0);

  it('finds the GameButton call sites at all', () => {
    // Guards the walk itself: a parser that matched nothing would pass every rule below.
    expect(screens.length).toBeGreaterThan(20);
  });

  it('never forges two buttons in the same file', () => {
    const offenders = screens
      .filter((f) => f.hot.length > 1)
      .map((f) => `${f.rel}: ${f.hot.length} forged buttons (lines ${f.hot.map((t) => t.line).join(', ')})`);
    expect(offenders).toEqual([]);
  });

  it('still forges something — the rule is a limit, not a ban', () => {
    expect(screens.filter((f) => f.hot.length === 1).length).toBeGreaterThan(20);
  });

  it('has somewhere for the secondary actions to have gone', () => {
    const inked = screens.filter((f) => f.tags.some((t) => /['"]ink['"]/.test(t.props)));
    expect(inked.length).toBeGreaterThan(5);
  });
});
