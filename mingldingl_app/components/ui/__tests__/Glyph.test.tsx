import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { Glyph, GLYPHS, GLYPH_NAMES, STROKE } from '../Glyph';
import { GLYPH_IMAGES, GLYPH_PIXELS } from '../glyphImages';
import { appSources } from '../../../lib/testing/sourceTree';
import { ACCENT, ICON_SIZES, INK } from '../../../lib/theme';

/**
 * The glyphs are drawings, so the tests look at the drawing: the `GLYPHS` table every image is
 * baked from (`scripts/gen-glyphs.js`). A name added to the table with no path behind it would
 * bake an empty image and show the user nothing.
 */

/** A decorative glyph is hidden from the queries too, which is the point of it. */
const HIDDEN = { includeHiddenElements: true };

const BAKED = path.join(__dirname, '..', '..', '..', 'assets', 'glyphs');

describe('Glyph', () => {
  it('cuts at least one mark for every name in the set', () => {
    const empty = GLYPH_NAMES.filter((name) => {
      const { lines, rings, dots } = GLYPHS[name];
      return lines.length + (rings?.length ?? 0) + (dots?.length ?? 0) === 0;
    });

    expect(empty).toEqual([]);
  });

  it('holds one hand across the set — one stroke weight for every cut', () => {
    expect(STROKE).toBe(2.4);
  });

  it('has a baked image at every size for every name, and nothing left over', () => {
    const wanted = GLYPH_NAMES.flatMap((name) => [
      ...GLYPH_PIXELS.map((px) => `${name}-${px}.png`),
      ...(GLYPHS[name].ground ? GLYPH_PIXELS.map((px) => `${name}-ground-${px}.png`) : []),
    ]).sort();
    expect(fs.readdirSync(BAKED).sort()).toEqual(wanted);
    for (const name of GLYPH_NAMES) expect(Object.keys(GLYPH_IMAGES[name]).map(Number)).toEqual([...GLYPH_PIXELS]);
  });

  it('draws in the accent at the icon ladder unless told otherwise', () => {
    const style = StyleSheet.flatten(render(<Glyph name="fire" />).getByTestId('glyph-fire', HIDDEN).props.style);

    expect(style).toEqual(expect.objectContaining({ width: ICON_SIZES.lg, height: ICON_SIZES.lg, tintColor: ACCENT.base }));
  });

  it('takes the size and colour it is given, seals included', () => {
    const style = StyleSheet.flatten(
      render(<Glyph name="seal" size={ICON_SIZES.hero} color={INK.dim} />).getByTestId('glyph-seal', HIDDEN).props.style,
    );

    expect(style).toEqual(expect.objectContaining({ width: ICON_SIZES.hero, height: ICON_SIZES.hero, tintColor: INK.dim }));
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
