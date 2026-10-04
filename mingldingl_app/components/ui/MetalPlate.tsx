import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { GRAIN, METAL_IMAGES, PLATE, SEAL, type PlateFinish } from './metal';

interface Props {
  finish?: PlateFinish;
  /** Which scratches show on the face (`grainFor(key)`), or null for a clean face. */
  grain?: number | null;
  /** How strongly the grain shows; the frame itself is always at full strength. */
  grainOpacity?: number;
  /** A wax seal pressed over the upper-right rivet, in this colour: the plate's deed is done. */
  seal?: string;
  /** The plate's own metal, for a plate laid on a surface that is not already metal (a card). */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The light on a riveted plate, laid over whatever fill the caller already paints: four corner
 * rivets, a rim rubbed bright where a hand goes, scratches on the face. It carries no colour of
 * its own (see `scripts/gen-metal.js`), so the same wear sits on the forged button's gold, the
 * Gate's iron or a plaque's bronze.
 *
 * Only for objects that bind, lock or guard — the forged button, the Gate, the plaque a vow or a
 * rite is struck onto, the Guild House plate. Never cards, rows, chat or headers.
 *
 * The frame is a nine-slice built from clipped views rather than `capInsets`, which only iOS
 * honours: the corners stay their own size, the edges stretch along their length only.
 * Decorative, so it takes no touches and says nothing to a screen reader.
 */
export function MetalPlate({ finish = 'worn', grain = null, grainOpacity = 0.9, seal, fill, style }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0 && (w !== size?.w || h !== size?.h)) setSize({ w, h });
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      onLayout={onLayout}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      testID="metal-plate"
    >
      {fill && <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />}
      {grain !== null && (
        <View style={[StyleSheet.absoluteFill, styles.clip, { opacity: grainOpacity }]}>
          <Image source={METAL_IMAGES.grain[grain]} style={styles.grain} resizeMode="cover" />
        </View>
      )}
      {size && <NineSlice source={METAL_IMAGES.plate[finish]} w={size.w} h={size.h} />}
      {seal && size && (
        <View style={[styles.seal, { left: size.w - PLATE.cap / 2 - SEAL / 2, top: PLATE.cap / 2 - SEAL / 2 }]}>
          <Image source={METAL_IMAGES.seal.body} style={[styles.sealImg, { tintColor: seal }]} />
          <Image source={METAL_IMAGES.seal.detail} style={styles.sealImg} />
        </View>
      )}
    </View>
  );
}

function NineSlice({ source, w, h }: { source: ImageSourcePropType; w: number; h: number }) {
  const c = Math.min(PLATE.cap, w / 2, h / 2);
  const { width: W, height: H } = PLATE;
  // How far the middle band of the bake stretches to fill the middle of this box, each way.
  const sx = Math.max(0, w - 2 * c) / (W - 2 * PLATE.cap);
  const sy = Math.max(0, h - 2 * c) / (H - 2 * PLATE.cap);
  const cols = [
    { x: 0, w: c, imgW: W, imgX: 0 },
    { x: c, w: w - 2 * c, imgW: W * sx, imgX: -PLATE.cap * sx },
    { x: w - c, w: c, imgW: W, imgX: c - W },
  ];
  const rows = [
    { y: 0, h: c, imgH: H, imgY: 0 },
    { y: c, h: h - 2 * c, imgH: H * sy, imgY: -PLATE.cap * sy },
    { y: h - c, h: c, imgH: H, imgY: c - H },
  ];
  return (
    <>
      {rows.flatMap((r, ri) =>
        cols.map((col, ci) =>
          col.w > 0 && r.h > 0 ? (
            <View key={`${ri}${ci}`} style={[styles.clip, { position: 'absolute', left: col.x, top: r.y, width: col.w, height: r.h }]}>
              <Image
                source={source}
                resizeMode="stretch"
                style={{ position: 'absolute', left: col.imgX, top: r.imgY, width: col.imgW, height: r.imgH }}
              />
            </View>
          ) : null,
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  grain: { width: GRAIN.width, height: GRAIN.height, minWidth: '100%', minHeight: '100%' },
  seal: { position: 'absolute', width: SEAL, height: SEAL },
  sealImg: { position: 'absolute', width: SEAL, height: SEAL },
});
