import { StyleSheet, View } from 'react-native';
import { Glyph, type GlyphName } from './Glyph';
import { circle, ICON_SIZES, MATERIAL, tint } from '../../lib/theme';

/**
 * A material, drawn the same way everywhere it appears — the Satchel, the hearth, a thread, the
 * wall — rather than each screen inventing its own rendering of "this is wax" or "this is gold".
 * `docs/design/sealed-fire/boards/Materials.dc.html` is the source of the six; `MATERIAL` in
 * `theme.ts` is their colour.
 *
 * The swatch is the material's own colour at a fifth its strength, the way `AppCard`'s hairline
 * tints its border colour rather than drawing it flat — a wash a viewer reads as "made of this",
 * not a solid chip fighting the glyph sitting on it.
 */

export type Material = keyof typeof MATERIAL;

interface Props {
  material: Material;
  glyph: GlyphName;
  size?: number;
  /**
   * What the mark says, for a screen reader. Pass it only where the mark carries meaning on its
   * own, the same rule `Glyph`'s own `label` holds to — beside a row already naming the material,
   * it would read the word twice.
   */
  label?: string;
}

export function MaterialMark({ material, glyph, size = ICON_SIZES.lg, label }: Props) {
  const colour = MATERIAL[material];
  // Mirrors the accessibility split every hidden-or-labelled mark in this app makes (`Glyph`,
  // `FrostEdge`): labelled is an image with that label, unlabelled is taken out of the tree.
  const a11y = label
    ? { accessible: true as const, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false as const, importantForAccessibility: 'no' as const, accessibilityElementsHidden: true };

  return (
    <View
      testID={`material-${material}`}
      style={[styles.swatch, circle(size), { backgroundColor: tint(colour, 0.18) }]}
      {...a11y}
    >
      <Glyph name={glyph} size={Math.round(size * 0.7)} color={colour} />
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { alignItems: 'center', justifyContent: 'center' },
});
