import { useEffect, useState } from 'react';
import { Image, Pressable, View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { Message } from '../../hooks/useChat';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, PRESS, SPACE, STATUS } from '../../lib/theme';
import { FieldError } from '../ui/StateBlock';
import { Icon } from '../ui/Icon';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { STONE_ASPECTS, STONE_IMAGES, STONE_SHADOW } from './stoneImages';
import { i18n } from '../../lib/i18n';

interface Props {
  message: Message;
  myId: string | undefined;
  onRetry?: (id: string) => void;
  /** The newest letter in the thread drifts on the air; every other one has settled. */
  floating?: boolean;
}

/**
 * One letter of the thread, on a shard of stone floating over its own shadow (`gen-stones.js`).
 *
 * The ledger used to set every line flush left on the bare floor, told apart only by italic and
 * a ring's colour — which nobody could read at a glance. Now who spoke is said three ways before a
 * word is read: mine float on the right in warm sandstone, theirs on the left in cold slate, each
 * with its own grain. Mine keeps the app's italic voice; theirs is roman, the person's own hand.
 *
 * A shard has to fit any letter, so the row measures itself and takes the baked shard nearest its
 * shape (one of three breaks of rock, chosen by the letter's id so it never changes), stretched
 * the rest of the way. Only the newest letter drifts: a whole thread bobbing is tiring to read
 * and costs every frame on a small phone.
 */
export function LetterRow({ message, myId, onRetry, floating = false }: Props) {
  const isMine = (!!myId && message.senderId === myId) || message.senderId === 'me';
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const aspect = size ? size.width / size.height : DEFAULT_ASPECT;
  const stone = STONE_IMAGES[isMine ? 'sand' : 'slate'][nearestAspect(aspect)][variantOf(message.id)];

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size?.width || height !== size?.height)) setSize({ width, height });
  };

  const drift = useDrift(floating);

  const row = (
    <View
      testID="letter"
      style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs, isSending && styles.sending, isFailed && styles.failed]}
    >
      {/* Held unseen until the shard has measured and its stone can be drawn: the frame between
          was bare text on the floor, and on a busy open it lasted seconds. A letter arrives on its
          stone or not at all. */}
      <Animated.View testID="letter-shard" style={[styles.shardWrap, drift, !size && styles.unmeasured]}>
        <Image source={STONE_SHADOW} resizeMode="stretch" style={styles.shadow} accessible={false} />
        <View style={styles.shard} onLayout={onLayout}>
          {/* Sized in points off the row's own measure: percentages and absolute fills both lost
              to the asset's intrinsic size on Android. Nothing is drawn until it has measured. */}
          {size && <Image source={stone} resizeMode="stretch" style={[styles.stone, size]} accessible={false} />}
          <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>{message.content}</Text>
          {isFailed && (
            <View style={styles.retryRow}>
              <Icon name="alert-circle" size={ICON_SIZES.sm} color={STATUS.danger} />
              <FieldError>{i18n.t('message_tap_to_retry')}</FieldError>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );

  // The whole failed letter is the retry target, not the small line under it: the line you are
  // trying to send again is the thing on screen, and a two-word strip is a hard thing to hit.
  // The label has to carry the letter's own words too — labelling the wrapper hides everything
  // inside it, so a screen reader heard only "tap to retry" and never which letter failed.
  return isFailed ? (
    <Pressable
      onPress={() => onRetry?.(message.id)}
      accessibilityRole="button"
      accessibilityLabel={`${message.content}. ${i18n.t('message_tap_to_retry')}`}
    >
      {row}
    </Pressable>
  ) : row;
}

/** A one-line letter's shape before it has measured itself. */
const DEFAULT_ASPECT = 3.4;

export function nearestAspect(aspect: number): number {
  let best = 0;
  for (let i = 1; i < STONE_ASPECTS.length; i++) {
    // Compared as ratios, not differences: 1.4 → 2.2 is as big a step as 5 → 7.5.
    if (Math.abs(Math.log(aspect / STONE_ASPECTS[i])) < Math.abs(Math.log(aspect / STONE_ASPECTS[best]))) best = i;
  }
  return best;
}

/** Which break of rock a letter gets: fixed by its id, so a letter never changes stone. */
export function variantOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % STONE_IMAGES.sand[0].length;
}

/** How far the newest shard rises and falls, and how long one breath of it takes. */
const DRIFT_PT = 3;
const DRIFT_MS = 1800;

function useDrift(floating: boolean) {
  const level = useVfxLevel();
  const y = useSharedValue(0);
  const on = floating && motionAllowed(level);
  useEffect(() => {
    if (!on) {
      cancelAnimation(y);
      y.value = withTiming(0, { duration: 300 });
      return;
    }
    y.value = withRepeat(withTiming(-DRIFT_PT, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(y);
  }, [on, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/**
 * The crag under each shard is a fifth of its baked height; the text keeps clear of it, so the
 * bottom padding carries that much more than the top.
 */
const CRAG_PT = 12;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: SPACE.lg },
  rowMine: { justifyContent: 'flex-end', paddingLeft: SPACE.huge },
  rowTheirs: { justifyContent: 'flex-start', paddingRight: SPACE.huge },
  sending: { opacity: 0.8 },
  failed: { opacity: PRESS.dimmed },
  shardWrap: { maxWidth: '100%' },
  unmeasured: { opacity: 0 },
  shard: {
    paddingHorizontal: SPACE.lg + SPACE.xs,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md + CRAG_PT,
  },
  stone: { position: 'absolute', top: 0, left: 0 },
  // A gap under the crag, then the shadow: the shard is hovering, not resting.
  shadow: { position: 'absolute', left: '12%', width: '76%', bottom: -SPACE.md, height: SPACE.md, opacity: 0.7 },
  text: { fontSize: FONT_SIZES.lg, lineHeight: LEADING.lg, color: INK.primary },
  textMine: { fontFamily: FONTS.bodyItalic },
  textTheirs: { fontFamily: FONTS.body },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
});
