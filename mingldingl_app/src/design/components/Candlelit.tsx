import { BlurMask, Canvas, ImageShader, Rect, useImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ART, type ArtName } from '../art/manifest';
import { withAlpha } from '../effects';
import { color, dimension } from '../tokens';

/** How far the card's edge fades into the night. */
const FADE = 18;
/** The gold line sits this far inside the edge, with a gap at the top for the lozenge. */
const RULE_INSET = 10;
const LOZENGE = 7;
const GAP = 22;

/** How far a candlelit card pads its content in, clear of the gold line. */
export const CANDLELIT_PAD = dimension.space6;

/**
 * A card inside a fine gold line with the lozenge at its crown (Figma 26:3). Lit by art (the
 * Tavern's night, warmed from beneath by the candles), its edges fade into the World Floor instead
 * of ending; on a plain `fill` (the Square's bell, the keepsake) it is a flat panel, with no canvas,
 * so a captured card comes out whole. Fills its parent; put it first, behind the content, and pad
 * the content by `CANDLELIT_PAD`.
 */
export function Candlelit({ art, fill }: { art: ArtName; fill?: never } | { art?: never; fill: string }) {
  const image = useImage(art ? ART[art] : null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {fill ? <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} /> : null}
      {size && image ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* the art paints a soft-edged rect, so the card fades into the night instead of ending */}
          <Rect x={FADE / 2} y={FADE / 2} width={size.width - FADE} height={size.height - FADE}>
            <ImageShader
              image={image}
              fit="cover"
              rect={{ x: 0, y: 0, width: size.width, height: size.height }}
            />
            <BlurMask blur={FADE / 2} style="normal" />
          </Rect>
        </Canvas>
      ) : null}
      <View style={styles.rule}>
        <View style={styles.crown}>
          <View style={styles.crownLine} />
          <View style={styles.crownGap} />
          <View style={styles.crownLine} />
        </View>
      </View>
      <View style={styles.lozenge} />
    </View>
  );
}

const ruleColor = withAlpha(color.borderGold, 0.45);

const styles = StyleSheet.create({
  // three sides of the line; the top is drawn by `crown`, parted for the lozenge
  rule: {
    position: 'absolute',
    top: RULE_INSET,
    left: RULE_INSET,
    right: RULE_INSET,
    bottom: RULE_INSET,
    borderWidth: dimension.strokeHairline,
    borderTopWidth: 0,
    borderColor: ruleColor,
  },
  crown: { flexDirection: 'row', marginHorizontal: -dimension.strokeHairline },
  crownLine: { flex: 1, height: dimension.strokeHairline, backgroundColor: ruleColor },
  crownGap: { width: GAP },
  lozenge: {
    position: 'absolute',
    top: RULE_INSET - LOZENGE / 2 + 0.5,
    alignSelf: 'center',
    width: LOZENGE,
    height: LOZENGE,
    backgroundColor: color.accentGold,
    transform: [{ rotate: '45deg' }],
  },
});
