import {
  Canvas,
  Group,
  LinearGradient,
  Rect,
  Image as SkiaImage,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ART, type ArtName } from '../art/manifest';

/**
 * A painting that dissolves into the World Floor at its edges instead of ending in a hard
 * rectangle (the Hearth's window: its stone arch fades into the night). Fills its parent.
 * The dissolve is an alpha ramp `fade` px deep on every edge — the floor's stars show through
 * the last of the stone — not a blur, which only softens the cut and leaves the edge where it was.
 */
export function FadedArt({ name, fade = 56 }: { name: ArtName; fade?: number }) {
  const image = useImage(ART[name]);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size && image ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group layer>
            <SkiaImage image={image} x={0} y={0} width={size.width} height={size.height} fit="cover" />
            <Ramp width={size.width} height={size.height} fade={fade} axis="y" />
            <Ramp width={size.width} height={size.height} fade={fade} axis="x" />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

/** Keeps the painting's alpha in the middle and ramps it to nothing over `fade` px at both ends of one axis. */
function Ramp({
  width,
  height,
  fade,
  axis,
}: {
  width: number;
  height: number;
  fade: number;
  axis: 'x' | 'y';
}) {
  const length = axis === 'x' ? width : height;
  const depth = Math.min(fade, length / 2) / length;
  return (
    <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
      <LinearGradient
        start={vec(0, 0)}
        end={axis === 'x' ? vec(width, 0) : vec(0, height)}
        colors={['transparent', 'black', 'black', 'transparent']}
        positions={[0, depth, 1 - depth, 1]}
      />
    </Rect>
  );
}
