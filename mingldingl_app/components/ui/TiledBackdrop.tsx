import { useState } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';

interface Props {
  source: ImageSourcePropType;
  tileSize?: number;
  opacity?: number;
}

// resizeMode="repeat" only tiles on native — react-native-web renders the
// <img> at its native size instead of stretching/repeating it. Tiling a
// measured grid of the same square image works identically on every
// platform, so there's no per-platform branch to keep in sync. One shared
// layer behind a whole screen, not per list item, so it costs nothing as
// the screen's content grows.
export function TiledBackdrop({ source, tileSize = 256, opacity = 0.14 }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  const cols = Math.ceil(size.w / tileSize);
  const rows = Math.ceil(size.h / tileSize);

  return (
    <View style={[styles.backdrop, { opacity }]} onLayout={onLayout}>
      {size.w > 0 && Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }).map((_, c) => (
            <Image key={c} source={source} style={{ width: tileSize, height: tileSize }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', pointerEvents: 'none' },
  row: { flexDirection: 'row' },
});
