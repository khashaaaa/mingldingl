import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { boxShadow } from '../effects';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

/** The fields of a stored photo a tile needs (PhotoView from the engine). */
export type TilePhoto = { id: string; url: string; thumbHash: string };

/** Someone else's portrait: no url while it is sealed (only its ThumbHash leaves the engine). */
export type SealablePhoto = { id: string; url?: string | null; thumbHash: string };

type Props =
  | { state: 'empty'; onPress: () => void }
  | { state: 'uploading'; progress: number }
  | { state: 'failed'; onRetry: () => void }
  | {
      state: 'filled';
      photo: TilePhoto;
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
          accessibilityValue={{ min: 0, max: 100, now: Math.round(props.progress * 100) }}
          style={[styles.tile, styles.sunken]}
        >
          <View style={[styles.candle, { boxShadow: boxShadow('glowEmber') }]} />
          <View style={styles.track}>
            <View
              testID="upload-progress"
              style={[styles.progress, { width: `${clamp(props.progress) * 100}%` }]}
            />
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
            placeholder={{ thumbhash: props.photo.thumbHash }}
            recyclingKey={props.photo.id}
            contentFit="cover"
            transition={240}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      );
  }
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

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
});
