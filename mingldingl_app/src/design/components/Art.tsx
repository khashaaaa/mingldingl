import { Image, type ImageStyle, type StyleProp, StyleSheet, View } from 'react-native';
import { ART, type ArtName } from '../art/manifest';
import { GLYPHS, type GlyphName } from '../glyphs';
import { color } from '../tokens';
import type { ColorName } from './Txt';

/**
 * Art that fills its parent edge to edge (a plate, the parchment). The image sits in an unpadded
 * full-bleed box and takes 100% of it: Android keeps an absolutely positioned image at its
 * intrinsic width, and percentages on the image itself resolve against the parent's padded box.
 * No measuring, so the art is there on the first frame (a measured plate came a frame late).
 */
export function FillArt({ name }: { name: ArtName }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={ART[name]} style={styles.fill} resizeMode="cover" fadeDuration={0} />
    </View>
  );
}

/** A painted asset from Figma page 04/06 (1x/2x/3x picked by the device). */
export function Art({
  name,
  style,
  fit = 'cover',
}: {
  name: ArtName;
  style?: StyleProp<ImageStyle>;
  fit?: 'cover' | 'contain' | 'stretch';
}) {
  // Bundled art is there at once: Android would fade every image in over 300 ms.
  return (
    <Image
      source={ART[name]}
      style={style}
      resizeMode={fit}
      fadeDuration={0}
      accessibilityIgnoresInvertColors
    />
  );
}

/** An ink glyph from Figma page 05, tinted. Images, never live SVG. */
export function Glyph({
  name,
  size = 24,
  tint = 'textPrimary',
}: {
  name: GlyphName;
  size?: number;
  tint?: ColorName;
}) {
  return (
    <Image
      source={GLYPHS[name]}
      style={{ width: size, height: size, tintColor: color[tint] }}
      fadeDuration={0}
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
