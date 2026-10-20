import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { boxShadow } from '../effects';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Flicker } from './Flicker';
import { Txt } from './Txt';

/** The fields of a stored photo a tile needs (PhotoView from the engine). */
export type TilePhoto = { id: string; url: string; thumbHash: string };

/** Someone else's portrait: no url while it is sealed (only its ThumbHash leaves the engine). */
export type SealablePhoto = { id: string; url?: string | null; thumbHash: string };

type Props =
  | { state: 'empty'; onPress: () => void }
  /** `uri` is the picked file on the device; with no `progress` the ember runs back and forth. */
  | { state: 'uploading'; uri?: string; progress?: number }
  | { state: 'failed'; uri?: string; onRetry: () => void }
  | {
      state: 'filled';
      photo: TilePhoto;
      /** The device's own copy of a portrait just uploaded: shown until the stored one loads, so it never blurs. */
      local?: string;
      /** What a screen reader calls it, e.g. "Portrait 2 of 4"; defaults to "Your portrait". */
      label?: string;
      onPress?: () => void;
      onLongPress?: () => void;
    };

/**
 * One portrait slot, 3:4. The image is cached by the photo's id, not its URL: URLs are signed and
 * change every fetch, and a new URL for the same photo must not download it again.
 */
export function PhotoTile(props: Props) {
  switch (props.state) {
    case 'empty':
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('photo.add')}
          onPressIn={() => feedback('press')}
          onPress={props.onPress}
          style={[styles.tile, styles.empty]}
        >
          <Glyph name="frame" size={24} tint="textMuted" />
        </Pressable>
      );
    case 'uploading':
      return (
        <View
          accessible
          accessibilityLabel={t('photo.uploading')}
          accessibilityRole="progressbar"
          accessibilityValue={
            props.progress === undefined
              ? undefined
              : { min: 0, max: 100, now: Math.round(props.progress * 100) }
          }
          style={[styles.tile, styles.sunken]}
        >
          {props.uri ? <Developing uri={props.uri} /> : null}
          <Flicker>
            <View style={[styles.candle, { boxShadow: boxShadow('glowEmber') }]} />
          </Flicker>
          <View style={styles.track}>
            {props.progress === undefined ? (
              <Sweep />
            ) : (
              <View
                testID="upload-progress"
                style={[styles.progress, { width: `${clamp(props.progress) * 100}%` }]}
              />
            )}
          </View>
        </View>
      );
    case 'failed':
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('photo.failed')}
          onPressIn={() => feedback('press')}
          onPress={props.onRetry}
          style={[styles.tile, styles.sunken, { borderColor: color.statusDanger }]}
        >
          {props.uri ? (
            <>
              <Image source={{ uri: props.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, styles.veil, { opacity: 0.7 }]} />
            </>
          ) : null}
          <Txt variant="labelS" color="textDanger">
            {t('photo.failed')}
          </Txt>
        </Pressable>
      );
    case 'filled':
      return (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={props.label ?? t('photo.portrait')}
          accessibilityHint={props.onLongPress ? t('photo.reorderHint') : undefined}
          onPress={props.onPress}
          onLongPress={
            props.onLongPress &&
            (() => {
              feedback('press');
              props.onLongPress?.();
            })
          }
          style={[styles.tile, styles.filled]}
        >
          <Image
            source={{ uri: props.photo.url, cacheKey: props.photo.id }}
            placeholder={props.local ? { uri: props.local } : { thumbhash: props.photo.thumbHash }}
            placeholderContentFit="cover"
            recyclingKey={props.photo.id}
            contentFit="cover"
            transition={props.local ? 0 : 240}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      );
  }
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** The picked portrait under a breathing veil, as if it were still coming up out of the dark. */
function Developing({ uri }: { uri: string }) {
  const reduce = useReduceMotion();
  const veil = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    veil.value = withRepeat(
      withTiming(1, { duration: MOTION.candle.duration / 2, easing: curve(MOTION.candle.easing) }),
      -1,
      true,
    );
    return () => cancelAnimation(veil);
  }, [veil, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: 0.62 - 0.18 * veil.value }));
  return (
    <>
      <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, a]} />
    </>
  );
}

/** An ember running along the foot of the tile while the upload has no count to show. */
function Sweep() {
  const reduce = useReduceMotion();
  const run = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    run.value = withRepeat(
      withTiming(1, { duration: MOTION.candle.duration / 2, easing: curve(MOTION.candle.easing) }),
      -1,
      true,
    );
    return () => cancelAnimation(run);
  }, [run, reduce]);
  const a = useAnimatedStyle(() => ({ left: `${run.value * 60}%` }));
  return (
    <Animated.View testID="upload-sweep" style={[styles.progress, styles.sweep, reduce && styles.still, a]} />
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 108,
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderRadius: dimension.radiusSm,
    overflow: 'hidden',
  },
  empty: { backgroundColor: color.bgSunken, borderStyle: 'dashed' },
  sunken: { backgroundColor: color.bgSunken },
  filled: { backgroundColor: color.bgPanel },
  candle: { width: 8, height: 12, borderRadius: 6, backgroundColor: color.accentEmber },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  progress: { height: 2, backgroundColor: color.accentEmber },
  sweep: { position: 'absolute', width: '40%', boxShadow: boxShadow('glowEmber') },
  still: { left: 0, width: '100%', opacity: 0.5 },
  veil: { backgroundColor: color.bgScrim },
});
