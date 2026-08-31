import { useState } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';

interface Props {
  source: ImageSourcePropType;
  tileSize?: number;
  opacity?: number;
}

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
            <Image
              key={c}
              source={source}
              style={{
                width: tileSize,
                height: tileSize,
                transform: [{ scaleX: c % 2 ? -1 : 1 }, { scaleY: r % 2 ? -1 : 1 }],
              }}
            />
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
