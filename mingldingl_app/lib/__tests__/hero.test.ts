import { appSources, hasProp, openingTags } from '../testing/sourceTree';

/**
 * One hero per screen.
 *
 * The kit's rule for surfaces is "one hero panel, then rows": the knots and the parchment belong
 * to the one panel a screen is *for*, and everything else is a quieter card or a hairline row.
 * Eleven call sites used to pass `textured`, four of them on the same screen, which made the
 * ornament mean nothing — a decoration rather than a ranking. `hero` replaced `textured` so the
 * two halves of that ornament (knots and texture) can no longer drift apart, and this test is
 * what stops a second hero from appearing on a screen later.
 *
 * Counted per file rather than per route: every component holding an `AppCard` is rendered on
 * exactly one screen, so a file is a screen's worth of surface. The JSX scanner it counts with
 * lives in `lib/testing/sourceTree.ts`, because the same rule is owed to the forged button next.
 */

describe('the JSX opening-tag scanner', () => {
  it('reads a whole multi-line opening, and is not ended by a `>` in a string or an arrow', () => {
    const src = [
      'const a = (',
      '  <AppCard',
      '    hero',
      '    label="a > b"',
      '    onPress={() => go({ deep: true })}',
      '  >',
      '    <AppCardish />',
      '  </AppCard>',
      ');',
    ].join('\n');
    const tags = openingTags(src, 'AppCard');
    expect(tags).toHaveLength(1);
    expect(tags[0].line).toBe(2);
    expect(hasProp(tags[0].props, 'hero')).toBe(true);
    expect(hasProp(tags[0].props, 'onPress')).toBe(true);
    expect(hasProp(tags[0].props, 'tier')).toBe(false);
  });
});

describe('one hero panel per screen', () => {
  const withCards = appSources()
    .map((f) => ({ rel: f.rel, tags: openingTags(f.text, 'AppCard') }))
    .filter((f) => f.tags.length > 0);

  it('finds the AppCard call sites at all', () => {
    // Guards the walk itself: a parser that matched nothing would pass every rule below.
    expect(withCards.length).toBeGreaterThan(10);
  });

  it('never knots two panels in the same file', () => {
    const offenders = withCards
      .map((f) => ({ rel: f.rel, heroes: f.tags.filter((t) => hasProp(t.props, 'hero')) }))
      .filter((f) => f.heroes.length > 1)
      .map((f) => `${f.rel}: ${f.heroes.length} hero cards (lines ${f.heroes.map((h) => h.line).join(', ')})`);
    expect(offenders).toEqual([]);
  });

  it('still knots something — the rule is a limit, not a ban', () => {
    const heroes = withCards.flatMap((f) => f.tags.filter((t) => hasProp(t.props, 'hero')).map(() => f.rel));
    expect(heroes.length).toBeGreaterThan(0);
  });

  it('has no call site left on the old `textured` prop', () => {
    const offenders = appSources()
      .flatMap((f) => f.text.split('\n').map((text, i) => ({ rel: f.rel, line: i + 1, text })))
      .filter((l) => /\btextured\b/.test(l.text))
      .map((l) => `${l.rel}:${l.line}`);
    expect(offenders).toEqual([]);
  });
});
