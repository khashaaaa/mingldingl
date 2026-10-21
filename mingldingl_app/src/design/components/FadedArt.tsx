import { BlurMask, Canvas, ImageShader, Rect, useImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ART, type ArtName } from '../art/manifest';

/**
 * A painting that dissolves into the World Floor at its edges instead of ending in a hard
 * rectangle (the Hearth's window: its stone arch fades into the night). Fills its parent.
 */
export function FadedArt({ name, fade = 28 }: { name: ArtName; fade?: number }) {
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
          <Rect x={fade / 2} y={fade / 2} width={size.width - fade} height={size.height - fade}>
            <ImageShader
              image={image}
              fit="cover"
              rect={{ x: 0, y: 0, width: size.width, height: size.height }}
            />
            <BlurMask blur={fade / 2} style="normal" />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}
