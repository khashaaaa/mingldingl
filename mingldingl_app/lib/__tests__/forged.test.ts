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
 *
 * The scanner reads `<GameButton>` tags, so a forged control built out of anything else is invisible
 * to it. `components/chat/WaxSealButton.tsx` is the one such control in the app, and it is exempt on
 * purpose rather than by oversight: sending a line is the chat's single deed, and it is drawn as a
 * disc of wax — a gold slab in the composer would say the seal is decoration. It is a `Pressable`
 * with `GameButton`'s own press-in and signal, it spends `app/chat/[matchId].tsx`'s forge, and no
 * `GameButton primary` may join it on that screen.
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

/**
 * Files whose forged buttons live in render branches that never appear together.
 *
 * The count is per file because a file is normally a screen's worth of action — but a file that
 * renders one of two alternative surfaces spends its forge twice on paper and once on screen.
 * `PhoneChangeModal` is the case: before a verification is started it draws a number field and
 * "verify now"; once verify.mn has a session it draws the instruction and "open the SMS app"
 * instead. Neither branch has two slabs, and holding the file to one left whichever branch lost
 * the coin toss with no deed at all — an `AlertModal` strip whose only actions were two ink links.
 *
 * The cap is 2, not "one per branch": counting branches means parsing the conditionals, and a
 * third forged button in a file that already earns this exception is exactly the regression the
 * rule is here to catch. Add an entry only with the two branches named.
 */
const BRANCHED = new Set([path.join('components', 'settings', 'PhoneChangeModal.tsx')]);

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
      .filter((f) => f.hot.length > (BRANCHED.has(f.rel) ? 2 : 1))
      .map((f) => `${f.rel}: ${f.hot.length} forged buttons (lines ${f.hot.map((t) => t.line).join(', ')})`);
    expect(offenders).toEqual([]);
  });

  it('keeps the branched exception honest — a file down to one forge no longer needs it', () => {
    const all = new Set(appSources().map((f) => f.rel));
    expect([...BRANCHED].filter((rel) => !all.has(rel))).toEqual([]);

    const stale = [...BRANCHED].filter((rel) => (screens.find((f) => f.rel === rel)?.hot.length ?? 0) < 2);
    expect(stale).toEqual([]);
  });

  it('still forges something — the rule is a limit, not a ban', () => {
    expect(screens.filter((f) => f.hot.length === 1).length).toBeGreaterThan(20);
  });

  it('has somewhere for the secondary actions to have gone', () => {
    const inked = screens.filter((f) => f.tags.some((t) => /['"]ink['"]/.test(t.props)));
    expect(inked.length).toBeGreaterThan(5);
  });
});

/**
 * …and the forge a screen borrows.
 *
 * Counting per file only sees the slabs a file writes itself. A screen that renders `CandidateCard`
 * or `QuestBoard` also carries the forged button *inside* that component, and the rule above could
 * not see it: a screen could hold one forge of its own plus one borrowed and pass. So a file's
 * count here is its own forged tags plus, recursively, those of every component it imports from
 * this app *and actually renders* (`<Name` appears in it). Modals stay exempt as before.
 *
 * A forged button drawn inside an `<AppModal>` or `<SheetModal>` region is left out of both counts —
 * the same exemption `components/modals/**` has, reached by shape rather than by folder: the
 * character sheet's share preview and its honour story sheet are their own surfaces. So is a
 * component rendered only inside such a region (the Flame Rite card in the chat's activities sheet).
 *
 * One level of honesty is lost on purpose: the scanner does not parse render branches. A screen
 * whose own forged button lives only in a failure state that *replaces* the borrowed component —
 * an early `return` for `isError`, or the other arm of a ternary — spends its forge once on screen
 * and twice on paper. Those are listed below with their branch named, capped at 2 like `BRANCHED`.
 */
const EXCLUSIVE_WITH_BORROWED: Record<string, string> = {
  // `if (isError) return` — the retry replaces the whole deck, so it never sits beside CandidateCard.
  [path.join('app', '(tabs)', 'discover.tsx')]: 'error early return vs CandidateCard',
  // `closed || (isError && !session) ? <StateBlock retry> : <SessionStatusCard>`.
  [path.join('app', '(tabs)', 'townsquare.tsx')]: 'error arm vs SessionStatusCard arm',
  // `callFailed ? <StateBlock rejoin> : <AgoraVideoCall>`, and `{!callFailed && <RoundPrompt>}`.
  [path.join('app', 'townsquare-round', '[sessionId].tsx')]: 'callFailed rejoin vs RoundPrompt',
  // The profile-load `return` with its retry vs `ErrorBoundary`'s own crash screen, which replaces the tree.
  [path.join('app', '_layout.tsx')]: 'profile-load error return vs ErrorBoundary crash screen',
};

/**
 * Wizards: files that render exactly one of their step components at a time, so they borrow the
 * largest step's forge rather than the sum of all of them.
 */
const WIZARDS = new Set([path.join('app', '(onboarding)', 'index.tsx')]);

/** A modal by role but not by folder (see the note at the top): held to the per-file rule, never
 *  borrowed from, because it is drawn over the screen that already spent its forge. */
const MODAL_BY_ROLE = new Set([path.join('components', 'settings', 'PhoneChangeModal.tsx')]);

describe('one forged button per screen, counting the ones it borrows', () => {
  // Modal regions blanked (newlines kept, so reported lines still point somewhere).
  const blankModals = (text: string) =>
    text.replace(/<(AppModal|SheetModal)\b[\s\S]*?<\/\1>/g, (m) => m.replace(/[^\n]/g, ' '));
  const sources = appSources().map((f) => ({ rel: f.rel, text: blankModals(f.text) }));
  const byRel = new Map(sources.map((f) => [f.rel, f]));
  const isScreen = (rel: string) =>
    (rel.startsWith('app' + path.sep) || rel.startsWith('components' + path.sep)) && !rel.startsWith(MODALS);

  function resolve(fromRel: string, spec: string): string | null {
    if (!spec.startsWith('.')) return null;
    const base = path.normalize(path.join(path.dirname(fromRel), spec));
    for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]) {
      if (byRel.has(candidate)) return candidate;
    }
    return null;
  }

  /** The app files this one imports a capitalised binding from and renders as a tag. */
  function rendered(rel: string): string[] {
    const text = byRel.get(rel)!.text;
    const out = new Set<string>();
    for (const m of text.matchAll(/import\s+(?!type\s)([^;]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
      const target = resolve(rel, m[2]);
      if (!target || !isScreen(target) || MODAL_BY_ROLE.has(target)) continue;
      const names: string[] = [];
      const def = m[1].match(/^\s*([A-Za-z_$][\w$]*)/);
      if (def) names.push(def[1]);
      const named = m[1].match(/\{([^}]*)\}/);
      for (const part of named ? named[1].split(',') : []) {
        const bits = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
        if (bits[0]) names.push(bits[bits.length - 1]);
      }
      if (names.some((n) => /^[A-Z]/.test(n) && openingTags(text, n).length > 0)) out.add(target);
    }
    return [...out];
  }

  const memo = new Map<string, number>();
  function total(rel: string, seen: Set<string> = new Set()): number {
    if (memo.has(rel)) return memo.get(rel)!;
    if (seen.has(rel)) return 0;
    seen.add(rel);
    const own = forged(byRel.get(rel)!.text).length;
    const deps = rendered(rel).map((dep) => total(dep, seen));
    const borrowed = WIZARDS.has(rel) ? Math.max(0, ...deps) : deps.reduce((sum, n) => sum + n, 0);
    memo.set(rel, own + borrowed);
    return own + borrowed;
  }

  const screens = sources.filter((f) => isScreen(f.rel)).map((f) => f.rel);

  it('sees the forge inside the components that always bring one', () => {
    // Guards the import walk: each of these hosts renders a component holding a forged button.
    const hosts: [string, string][] = [
      [path.join('app', '(tabs)', 'discover.tsx'), path.join('components', 'cards', 'CandidateCard.tsx')],
      [path.join('app', '(tabs)', 'townsquare.tsx'), path.join('components', 'townsquare', 'SessionStatusCard.tsx')],
      [path.join('app', '(tabs)', 'activity.tsx'), path.join('components', 'quest', 'QuestBoard.tsx')],
      [path.join('app', 'townsquare-round', '[sessionId].tsx'), path.join('components', 'townsquare', 'RoundPrompt.tsx')],
      [path.join('app', '(tabs)', 'profile.tsx'), path.join('components', 'profile', 'DeletionPendingBanner.tsx')],
    ];
    for (const [host, dep] of hosts) {
      expect({ host, renders: rendered(host) }).toEqual({ host, renders: expect.arrayContaining([dep]) });
      expect({ dep, forged: forged(byRel.get(dep)!.text).length }).toEqual({ dep, forged: 1 });
    }
  });

  it('never forges two buttons on one screen, borrowed ones included', () => {
    const offenders = screens
      .map((rel) => ({ rel, n: total(rel) }))
      .filter(({ rel, n }) => n > (BRANCHED.has(rel) || rel in EXCLUSIVE_WITH_BORROWED ? 2 : 1))
      .map(({ rel, n }) => `${rel}: ${n} forged (own ${forged(byRel.get(rel)!.text).length}; ${rendered(rel).filter((d) => total(d) > 0).map((d) => `${d} ${total(d)}`).join(", ")})`);
    expect(offenders).toEqual([]);
  });

  it('keeps the exclusive-branch list honest', () => {
    const stale = Object.keys(EXCLUSIVE_WITH_BORROWED).filter((rel) => !byRel.has(rel) || total(rel) < 2);
    expect(stale).toEqual([]);
    const wizardsGone = [...WIZARDS].filter((rel) => !byRel.has(rel) || rendered(rel).filter((d) => total(d) > 0).length < 2);
    expect(wizardsGone).toEqual([]);
  });
});

/**
 * …and the other half of the same rule: the secondary actions actually went there.
 *
 * "One forged, the rest ink" is two claims, and the count above only checks the first. A screen
 * could satisfy it forever while its remaining actions sat in `ghost` or `brass` — which is what
 * fifty of them did: a bordered slab reads as a button of a lower rank, not as "not the deed", so
 * settings looked like a stack of eleven equal commands and an encounter offered two slabs to
 * choose between. `danger` is untouched: destroying something is allowed to look like a thing you
 * can do wrong.
 *
 * Two surfaces are exempt by shape rather than by exception. A `components/modals/**` file is its
 * own surface with its own one deed. And a `SheetModal` picker is a *list* — its rows are a menu
 * of equal choices with no deed among them, and ink links stacked full-width read as prose, not as
 * a list to pick from; those four files hold their sheet rows and nothing else.
 */
describe('the rest are ink', () => {
  /** Picker sheets: every `GameButton` in these files is a row inside a `SheetModal`. */
  const SHEETS = [
    path.join('components', 'profile', 'ProfileAvatar.tsx'),
    path.join('components', 'PhotoGrid.tsx'),
    path.join('components', 'progression', 'HonourCase.tsx'),
    path.join('components', 'profile', 'OathCard.tsx'),
  ];

  /**
   * Screens whose board draws a metal there deliberately. Keep it empty unless a board says
   * otherwise, and name the board line beside each entry.
   *
   * `NameAgeStep` is not an action at all: `Naming.dc.html:43-47` draws "YOU ARE · Man / Woman" as
   * a chip pair, the chosen one lit — a state, not a deed. Ink has no chosen half, so inking both
   * would delete the answer from the screen. Its home is `ChoiceRow`, which is exactly that
   * drawing; moving it there is a layout change and waits for a wave that is allowed to make one.
   */
  const ALLOWED = new Set([path.join('components', 'onboarding', 'NameAgeStep.tsx')]);

  const held = appSources()
    .filter((f) => f.rel.startsWith('app' + path.sep) || f.rel.startsWith('components' + path.sep))
    .filter((f) => !f.rel.startsWith(MODALS) && !SHEETS.includes(f.rel));

  it('still has the sheets and the modals it exempts', () => {
    // A renamed file would otherwise widen the rule to nothing, silently.
    const all = new Set(appSources().map((f) => f.rel));
    expect(SHEETS.filter((s) => !all.has(s))).toEqual([]);
    expect([...ALLOWED].filter((s) => !all.has(s))).toEqual([]);
  });

  it('leaves no ghost or brass on a screen outside the allowlist', () => {
    const offenders = held
      .filter((f) => !ALLOWED.has(f.rel))
      .flatMap((f) =>
        openingTags(f.text, 'GameButton')
          .filter((t) => /['"](ghost|brass)['"]/.test(t.props))
          .map((t) => `${f.rel}:${t.line}`),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps the allowlist honest — an entry with nothing left to excuse is a stale entry', () => {
    const stale = [...ALLOWED].filter((rel) => {
      const file = held.find((f) => f.rel === rel);
      return !file || !openingTags(file.text, 'GameButton').some((t) => /['"](ghost|brass)['"]/.test(t.props));
    });
    expect(stale).toEqual([]);
  });
});
