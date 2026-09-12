import { render } from '@testing-library/react-native';
import path from 'path';
import { Glyph, GLYPH_NAMES } from '../Glyph';
import { appSources } from '../../../lib/testing/sourceTree';
import { marks, packed, type TreeNode } from '../../../lib/testing/svg';
import { ACCENT, ICON_SIZES, INK } from '../../../lib/theme';

/**
 * The glyphs are drawings, so the tests look at what was drawn. A component that renders an
 * empty `<Svg />` satisfies "it renders" and shows the user nothing, which is exactly the
 * failure a hand-cut set is prone to — a name added to the table with no path behind it.
 */

/** The two joinery props reach the native view as their enum positions: butt 0, round 1, square 2; miter 0. */
const SQUARE_CAP = 2;
const MITER_JOIN = 0;

/** A decorative glyph is hidden from the queries too, which is the point of it. */
const HIDDEN = { includeHiddenElements: true };

/** Whether a mark is a cut line rather than a filled seal. */
function isCut(mark: TreeNode) {
  return !mark.props?.fill;
}

describe('Glyph', () => {
  it('cuts at least one mark for every name in the set', () => {
    const empty = GLYPH_NAMES.filter((name) => marks(render(<Glyph name={name} />).toJSON()).length === 0);

    expect(empty).toEqual([]);
  });

  it('holds one hand across the set — 2.4, square caps, mitred corners', () => {
    const wrong: string[] = [];
    for (const name of GLYPH_NAMES) {
      for (const mark of marks(render(<Glyph name={name} />).toJSON()).filter(isCut)) {
        const { strokeWidth, strokeLinecap, strokeLinejoin } = mark.props ?? {};
        if (strokeWidth !== 2.4 || strokeLinecap !== SQUARE_CAP || strokeLinejoin !== MITER_JOIN) {
          wrong.push(`${name}: ${strokeWidth}/${strokeLinecap}/${strokeLinejoin}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('draws in the accent at the icon ladder unless told otherwise', () => {
    const { getByTestId, toJSON } = render(<Glyph name="fire" />);

    expect(getByTestId('glyph-fire', HIDDEN).props).toEqual(expect.objectContaining({
      width: ICON_SIZES.lg,
      height: ICON_SIZES.lg,
    }));
    for (const mark of marks(toJSON())) {
      expect(mark.props?.stroke ?? mark.props?.fill).toEqual(packed(ACCENT.base));
    }
  });

  it('takes the size and colour it is given, seals included', () => {
    const { getByTestId, toJSON } = render(<Glyph name="seal" size={ICON_SIZES.hero} color={INK.dim} />);

    expect(getByTestId('glyph-seal', HIDDEN).props).toEqual(expect.objectContaining({
      width: ICON_SIZES.hero,
      height: ICON_SIZES.hero,
    }));
    for (const mark of marks(toJSON())) {
      expect(mark.props?.stroke ?? mark.props?.fill).toEqual(packed(INK.dim));
    }
  });

  // The gap list asks for a label on every glyph that carries meaning by itself. A glyph beside
  // its own name is not one of those: read aloud, it says the name twice.
  it('announces a labelled glyph as an image', () => {
    const { getByTestId } = render(<Glyph name="bell" label="The first bell" />);

    expect(getByTestId('glyph-bell').props).toEqual(expect.objectContaining({
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'The first bell',
    }));
  });

  it('hides an unlabelled glyph from the screen reader', () => {
    const { getByTestId, queryByTestId } = render(<Glyph name="bell" />);

    // `no` would hide the `<Svg>` and leave its paths in the tree, to be read out one by one.
    expect(getByTestId('glyph-bell', HIDDEN).props).toEqual(expect.objectContaining({
      accessible: false,
      importantForAccessibility: 'no-hide-descendants',
      'aria-hidden': true,
    }));
    expect(queryByTestId('glyph-bell')).toBeNull();
  });
});

function source(rel: string): string {
  const file = appSources().find((f) => f.rel === rel);
  if (!file) throw new Error(`no source file ${rel}`);
  return file.text;
}

/**
 * Where an icon *is* the identity of a place or a deed — the five destinations, the six quests —
 * it is cut by hand. `Icon` stays for everything else, so these two files are where the swap has
 * to hold.
 */
describe('the hand-cut set is what identity uses', () => {
  it('gives the tab bar glyphs, not the stock library', () => {
    const text = source(path.join('app', '(tabs)', '_layout.tsx'));

    expect(text).toMatch(/import \{[^}]*\bGlyph\b[^}]*\} from '\.\.\/\.\.\/components\/ui\/Glyph'/);
    expect(text).toMatch(/<Glyph\b/);
    expect(text).not.toMatch(/\bIcon\b/);
  });

  it('gives every quest a cut rune, with none of the stock names left', () => {
    const text = source(path.join('components', 'quest', 'QuestBoard.tsx'));

    expect(text).toMatch(/QUEST_ICONS: Record<string, GlyphName>/);
    expect(text).toMatch(/<Glyph name=\{QUEST_ICONS\[/);
    const stock = ['bugle', 'snowflake', 'forum-outline', 'brain', 'handshake-outline', 'sword-cross'];
    expect(stock.filter((name) => text.includes(`'${name}'`))).toEqual([]);
  });
});
