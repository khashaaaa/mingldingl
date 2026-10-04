import { useRef } from 'react';
import { Tap } from '../ui/Tap';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, METAL, SPACE, TRACKING } from '../../lib/theme';
import { metalForRarity } from '../../lib/tiers';
import { InkDraw } from '../ui/InkDraw';
import { InkBleed } from '../vfx/InkBleed';
import { TOAST_STYLES, useToastMotion } from './Toast';

interface Props {
  title: string;
  points: number;
  visible: boolean;
  onDismiss: () => void;
  item?: { nameKey: string; rarity: string } | null;

  bottomOffset?: number;
  /** Anchors the toast this far from the top of its parent instead of to the bottom, for a screen
   *  whose bottom holds what the player reads next (Discover's plaque). */
  topOffset?: number;
  /** Extra room on each side, beyond the page gutter — to sit inside a card rather than over its frame. */
  inset?: number;
}

const RAY_ANGLES = [0, 30, 60, 90, 120, 150];
const HIDDEN_Y = 140;

export function LootToast({ title, points, visible, onDismiss, item, bottomOffset = 0, topOffset, inset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.8)).current;
  const rays = useRef(new Animated.Value(0)).current;
  const { translateY, opacity, hide } = useToastMotion({
    visible,
    offset: HIDDEN_Y,
    holdMs: 4000,
    onDismiss,
    enter: () => [
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }),
      Animated.timing(rays, { toValue: 0.5, duration: 500, useNativeDriver: true }),
    ],
    exit: () => [Animated.timing(rays, { toValue: 0, duration: 300, useNativeDriver: true })],
    settle: () => { scale.setValue(1); rays.setValue(0.5); },
    reset: () => { scale.setValue(0.8); rays.setValue(0); },
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        TOAST_STYLES.container,
        styles.container,
        inset > 0 && { left: SPACE.gutter + inset, right: SPACE.gutter + inset },
        topOffset != null ? { top: topOffset } : { bottom: insets.bottom + SPACE.gutter + bottomOffset },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      {/* A reward soaks in like ink rather than simply appearing. */}
      <InkBleed>
        <Tap
          style={[TOAST_STYLES.card, styles.card]}
          onPress={hide}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('alert_dismiss')}
        >
          <View style={styles.iconWrap}>
            {RAY_ANGLES.map((deg) => (
              <Animated.View
                key={deg}
                style={[styles.ray, { opacity: rays, transform: [{ rotate: `${deg}deg` }] }]}
              />
            ))}
            <InkDraw name="flame" size={ICON_SIZES.xl} color={METAL.ember} duration={700} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{title}</Text>
            {points > 0 && <Text style={styles.points}>{i18n.t('xp_earned', { points })}</Text>}
            {item && (
              <Text style={[styles.itemLine, { color: metalForRarity(item.rarity) }]}>
                ✦ {i18n.t(item.nameKey)}
              </Text>
            )}
          </View>
        </Tap>
      </InkBleed>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { zIndex: 999 },
  card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 36, height: 2, backgroundColor: ACCENT.bright },
  textCol: { flex: 1, gap: SPACE.hair },
  title: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md, color: INK.primary },
  points: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: ACCENT.base, letterSpacing: TRACKING.wide },
  itemLine: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm },
});
