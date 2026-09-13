import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MaterialMark, type Material } from '../MaterialMark';
import { marks } from '../../../lib/testing/svg';
import { ICON_SIZES, MATERIAL, tint } from '../../../lib/theme';

/**
 * One swatch per material, the same contract `Glyph.test.tsx` holds its drawings to: a render
 * smoke test per name, plus the accessibility split every hidden-or-labelled mark in this app
 * gets.
 */

const MATERIALS = Object.keys(MATERIAL) as Material[];

/** A decorative mark is hidden from the queries too, which is the point of it. */
const HIDDEN = { includeHiddenElements: true };

describe('MaterialMark', () => {
  it.each(MATERIALS)('renders the %s swatch at its testID', (material) => {
    const { getByTestId } = render(<MaterialMark material={material} glyph="seal" />);
    expect(getByTestId(`material-${material}`, HIDDEN)).toBeTruthy();
  });

  it('sizes the swatch at ICON_SIZES.lg by default, tinted from the material', () => {
    const { getByTestId } = render(<MaterialMark material="wax" glyph="candle" />);
    const swatch = StyleSheet.flatten(getByTestId('material-wax', HIDDEN).props.style);
    expect(swatch.width).toBe(ICON_SIZES.lg);
    expect(swatch.height).toBe(ICON_SIZES.lg);
    expect(swatch.backgroundColor).toBe(tint(MATERIAL.wax, 0.18));
  });

  it('takes the size it is given', () => {
    const { getByTestId } = render(<MaterialMark material="gold" glyph="pledge" size={ICON_SIZES.hero} />);
    const swatch = StyleSheet.flatten(getByTestId('material-gold', HIDDEN).props.style);
    expect(swatch.width).toBe(ICON_SIZES.hero);
    expect(swatch.height).toBe(ICON_SIZES.hero);
  });

  it("draws the glyph in the material's own colour", () => {
    const { toJSON } = render(<MaterialMark material="iron" glyph="forge" />);
    for (const mark of marks(toJSON())) {
      expect(mark.props?.stroke ?? mark.props?.fill).toBeTruthy();
    }
  });

  it('announces a labelled mark as an image', () => {
    const { getByTestId } = render(<MaterialMark material="bronze" glyph="seal" label="The oath sigil" />);
    expect(getByTestId('material-bronze').props).toEqual(expect.objectContaining({
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'The oath sigil',
    }));
  });

  it('hides an unlabelled mark from the screen reader', () => {
    const { getByTestId, queryByTestId } = render(<MaterialMark material="parchment" glyph="letters" />);
    expect(getByTestId('material-parchment', HIDDEN).props).toEqual(expect.objectContaining({
      accessible: false,
      importantForAccessibility: 'no',
      accessibilityElementsHidden: true,
    }));
    expect(queryByTestId('material-parchment')).toBeNull();
  });
});
