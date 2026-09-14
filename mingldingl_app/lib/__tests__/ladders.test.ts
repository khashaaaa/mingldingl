import { BADGE_SIZES, FONT_SIZES, ICON_SIZES, LEADING, PRESS, SCRIM, TRACKING } from '../theme';
import path from 'path';
import { appSources as sources } from '../testing/sourceTree';

/**
 * The ladders, enforced.
 *
 * Every axis in `theme.ts` acquired its ladder the same way: someone counted the distinct values
 * already in the codebase and found a number nobody could have chosen on purpose. Icon sizes had
 * seventeen, with 13 and 14 both in heavy use. Tracking had ten across fifty-one call sites.
 * `overlay()` had nine alphas. The gem badge — the app's identity mark — had eight sizes across
 * nine call sites, three of them within four pixels of each other.
 *
 * Writing the ladder down does not keep it. The next screen is written next to a neighbouring
 * file, not next to `theme.ts`, so the only thing that holds an axis together is a test that
 * fails when a bare number appears on it.
 */

/** Every place `pattern` matches with a bare number instead of a token, as `file:line`. */
function bareNumbers(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const { rel, text } of sources()) {
    text.split('\n').forEach((line, i) => {
      const m = line.match(pattern);
      if (m) hits.push(`${rel}:${i + 1}  ${m[0].trim()}`);
    });
  }
  return hits;
}

describe('type', () => {
  it('sets every size from the type ladder', () => {
    expect(bareNumbers(/fontSize: *[0-9]/)).toEqual([]);
  });

  it('sets every tracking from the tracking ladder', () => {
    expect(bareNumbers(/letterSpacing: *-?[0-9]/)).toEqual([]);
  });

  /** Six steps, because ten was ten people each picking a number between 0 and 4. */
  it('keeps the tracking ladder monotonic and small', () => {
    const steps = Object.values(TRACKING);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
  });
});

/**
 * The two styles that pair a size with a leading the map does not give it. Both carry the reason
 * in a comment beside them, and both were measured on device — the tab bar's display face shears
 * its descenders off at the snug step, and the report sheet's label is a single line where full
 * leading is dead space. A deviation belongs here, named, or it is drift.
 */
const LEADING_EXEMPT = [
  'app/(tabs)/_layout.tsx',
  'components/modals/ReportUserSheet.tsx',
];

describe('leading', () => {
  /**
   * The real invariant is not which ladder a call site names — it is that the size and the
   * leading in one style agree. Enforcing the spelling would have banned two decisions worth
   * keeping; enforcing the pairing catches the thing that actually goes wrong.
   */
  it('pairs every size with the leading that belongs to it', () => {
    const mismatched: string[] = [];
    for (const { rel, text } of sources()) {
      if (LEADING_EXEMPT.includes(rel)) continue;
      for (const m of text.matchAll(/\{[^{}]*\}/g)) {
        const size = m[0].match(/fontSize: FONT_SIZES\.(\w+)/);
        const lead = m[0].match(/lineHeight: (LEADING|LINE_HEIGHTS)\.(\w+)/);
        if (!size || !lead) continue;
        if (lead[1] !== 'LEADING' || lead[2] !== size[1]) {
          mismatched.push(`${rel}  FONT_SIZES.${size[1]} with ${lead[1]}.${lead[2]}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('covers every step of the type ladder, so no size is left without one', () => {
    expect(Object.keys(LEADING).sort()).toEqual(Object.keys(FONT_SIZES).sort());
  });

  it('never sets a leading tighter than its own size', () => {
    for (const key of Object.keys(FONT_SIZES) as (keyof typeof FONT_SIZES)[]) {
      expect({ key, size: FONT_SIZES[key], leading: LEADING[key] })
        .toMatchObject({ key });
      expect(LEADING[key]).toBeGreaterThanOrEqual(FONT_SIZES[key]);
    }
  });
});

describe('depth', () => {
  it('scrims with a named weight, never a bare alpha', () => {
    expect(bareNumbers(/overlay\( *[0-9.]/)).toEqual([]);
  });

  it('orders the scrim ladder from a hairline shadow to a total takeover', () => {
    const steps = Object.values(SCRIM);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});

describe('touch', () => {
  /**
   * Thirty of forty-eight touchables set no `activeOpacity` at all and so took React Native's
   * default of 0.2 — the row does not acknowledge the touch so much as briefly leave — while
   * the other eighteen split three ways.
   */
  /**
   * One touchable, so there is nowhere to put a press value.
   *
   * This rule replaced two that policed `activeOpacity=` as text. Those could only ever hold the
   * call sites already spelled that way: they left forty-two hand-copied props, and said nothing
   * about the same axis written `opacity: 0.4` on a disabled control — which is how three values
   * for "cannot be used" survived the ladder that was supposed to end them.
   */
  it('routes every tap through the one component that owns the press', () => {
    const offenders = sources()
      .filter((f) => f.rel !== path.join('components', 'ui', 'Tap.tsx'))
      .filter((f) => /<TouchableOpacity(?=[\s/>])|\bactiveOpacity=/.test(f.text))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  /**
   * The same rule reached around from the other side: a `Pressable` whose style is a function of
   * `pressed` is a touchable that owns its own press value again — `NextGatheringPill` faded itself
   * to a hand-picked 0.8 that way. A control that animates its own press (GameButton, the wax seal)
   * does it through `onPressIn`, never a `pressed` style, so this has nothing legitimate to catch.
   */
  it('never hand-writes a press style off `pressed`', () => {
    const offenders = sources()
      .filter((f) => /\(\s*\{\s*pressed\s*\}\s*\)\s*=>|\bpressed\s*(?:&&|\?)/.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('keeps the standard press distinguishable from no press at all', () => {
    expect(PRESS.opacity).toBeLessThan(PRESS.none);
    expect(PRESS.disabled).toBeLessThan(PRESS.opacity);
  });
});

describe('marks', () => {
  /**
   * A bare number, not a named one: the four sizes that come through a local const or a
   * computed clamp (`GLYPH`, `LAMP_SIZE`, a button's `sz.iconSize`, a placeholder sized to the
   * space it has left) all resolve to the ladder, and naming a thing is the point.
   */
  it('sizes every icon from the icon ladder', () => {
    const hits: string[] = [];
    for (const { rel, text } of sources()) {
      for (const m of text.matchAll(/<(?:Icon|Glyph)\b[^>]*?size=\{([^}]*)\}/g)) {
        if (/^\s*[\d.]+\s*$/.test(m[1])) hits.push(`${rel}  size={${m[1]}}`);
      }
    }
    expect(hits).toEqual([]);
  });

  /**
   * The badge is the first thing anyone learns about a stranger here. It draws everything from
   * `size`, so eight call-site sizes bought nothing at all — and 28, 30 and 32 are a difference
   * no one can see.
   */
  it('sizes the gem badge from its own ladder', () => {
    const hits: string[] = [];
    for (const { rel, text } of sources()) {
      for (const m of text.matchAll(/<GemTierBadge[^>]*?size=\{([^}]*)\}/g)) {
        if (!/BADGE_SIZES\./.test(m[1])) hits.push(`${rel}  size={${m[1]}}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps each badge step far enough from the next to be seen', () => {
    const steps = Object.values(BADGE_SIZES).sort((a, b) => a - b);
    for (let i = 1; i < steps.length; i++) {
      expect({ from: steps[i - 1], to: steps[i] }).toMatchObject({ from: steps[i - 1] });
      expect(steps[i] / steps[i - 1]).toBeGreaterThanOrEqual(1.25);
    }
  });
});

describe('the ladders stay ladders', () => {
  it('keeps every step of every size ladder distinct and ordered', () => {
    for (const ladder of [FONT_SIZES, ICON_SIZES, BADGE_SIZES]) {
      const steps = Object.values(ladder);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      expect(new Set(steps).size).toBe(steps.length);
    }
  });
});
