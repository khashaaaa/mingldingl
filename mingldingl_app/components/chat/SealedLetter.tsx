import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { signal } from '../../lib/world/feedback';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { i18n } from '../../lib/i18n';
import {
  COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, LINE_HEIGHTS, RADIUS, SPACE, tint,
} from '../../lib/theme';

interface Props {
  /** Called once the wax has broken and the card has unfolded; the real bubble takes over. */
  onOpen: () => void;
  /** The sender's tier colour when the match carries one; gold otherwise. */
  sealColor?: string;
}

const SEAL = 44;
const SEAL_BREAK_MS = 220;
const UNFOLD_MS = 280;

/**
 * A folded letter standing in for the first message of a thread.
 *
 * The first word someone sends you is the one message in the whole conversation that deserves a
 * beat before it is read, and a bubble gives it none. This is a parchment card with a round wax
 * seal on it; tapping it ticks (`press`), the seal shrinks and fades, the card folds away on its
 * top edge and `onOpen` hands the row back to `MessageBubble`. Reduce-motion skips straight to
 * the open letter — the tick still fires, it is not motion.
 */
export function SealedLetter({ onOpen, sealColor = COLORS.gold }: Props) {
  const animate = motionAllowed(useVfxLevel());
  const seal = useRef(new Animated.Value(1)).current;
  const fold = useRef(new Animated.Value(0)).current;
  const opening = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function breakSeal() {
    if (opening.current) return;
    opening.current = true;
    signal('press');

    if (!animate) {
      seal.setValue(0);
      fold.setValue(1);
      onOpen();
      return;
    }

    Animated.sequence([
      Animated.timing(seal, { toValue: 0, duration: SEAL_BREAK_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(fold, { toValue: 1, duration: UNFOLD_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();
    // The hand-over is on a timer rather than the animation callback so that it lands even when a
    // driver drops the completion (and so tests can advance it deterministically).
    timer.current = setTimeout(onOpen, SEAL_BREAK_MS + UNFOLD_MS);
  }

  const hint = i18n.t('letter_sealed_hint');

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={breakSeal}
        accessibilityRole="button"
        accessibilityLabel={hint}
        testID="sealed-letter"
      >
        <Animated.View
          style={[styles.card, {
            opacity: fold.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { perspective: 800 },
              { rotateX: fold.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
            ],
          }]}
        >
          {/* The fold line: the top flap sits a shade lighter than the body, as a real fold does. */}
          <View style={styles.flap} />
          <Animated.View
            style={[styles.seal, {
              backgroundColor: sealColor,
              borderColor: tint(COLORS.panelDeep, 0.35),
              opacity: seal,
              transform: [{ scale: seal.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            }]}
            testID="sealed-letter-wax"
          >
            <Icon name="seal" size={ICON_SIZES.md} color={tint(COLORS.panelDeep, 0.75)} />
          </Animated.View>
          <Text style={styles.hint} numberOfLines={2}>{hint}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACE.sm, maxWidth: '75%', alignSelf: 'flex-start' },
  card: {
    minWidth: 200,
    // The seal straddles the fold line (its centre sits on it), so the body copy starts a full
    // seal below the flap rather than under the wax.
    paddingTop: SPACE.xl + SEAL + SPACE.sm,
    paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: LINE.edge,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    overflow: 'visible',
  },
  flap: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    height: SPACE.xl + SEAL / 2,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderBottomWidth: 1,
    borderBottomColor: LINE.edge,
    backgroundColor: COLORS.panel,
  },
  seal: {
    position: 'absolute',
    top: SPACE.xl,
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.sm,
    lineHeight: LINE_HEIGHTS.sm,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});
