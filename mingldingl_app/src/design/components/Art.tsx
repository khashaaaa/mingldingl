import { useState } from 'react';
import { Image, type ImageStyle, type StyleProp, StyleSheet, View } from 'react-native';
import { ART, type ArtName } from '../art/manifest';
import { GLYPHS, type GlyphName } from '../glyphs';
import { color } from '../tokens';
import type { ColorName } from './Txt';

/**
 * Art that fills its parent edge to edge (a plate, the parchment). It measures the parent and
 * sizes the image in points: Android keeps an absolutely positioned image at its intrinsic width,
 * and percentages resolve against the padded box.
 */
export function FillArt({ name }: { name: ArtName }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size && <Image source={ART[name]} style={size} resizeMode="cover" />}
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
  return <Image source={ART[name]} style={style} resizeMode={fit} accessibilityIgnoresInvertColors />;
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
      accessibilityElementsHidden
    />
  );
}
