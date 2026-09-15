import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Tap } from '../ui/Tap';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, SURFACE, circle, tint as tintColor } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { Icon } from '../ui/Icon';

interface Props {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  /** Optional only when `disabled`: a locked banner is shown to explain itself, not to be tapped. */
  onPress?: () => void;
  /** Dimmed and inert, for a destination that exists but has not been earned yet. */
  disabled?: boolean;
  tint?: string;
  // 'icon' is the default: banner icons carry meaning (destination). 'knot' is for
  // banners whose destination is the ornament's own world, e.g. the campaign map.
  medallion?: 'icon' | 'knot';
  /** Merged over the banner row — e.g. to drop its side margin inside a card that pads itself. */
  style?: StyleProp<ViewStyle>;
}

export function QuestBanner({ icon, title, onPress, disabled = false, tint = ACCENT.base, medallion = 'icon', style }: Props) {
  const colour = disabled ? INK.dim : tint;
  return (
    <Tap onPress={onPress} disabled={disabled || !onPress} accessibilityRole="button" accessibilityState={{ disabled }}>
      <View style={[styles.row, { borderColor: tintColor(colour, 0.53) }, style]}>
        <View style={[styles.medallion, { borderColor: colour }]}>
          {medallion === 'knot' && !disabled ? (
            <Image source={ORNAMENTS.knotGold} testID="ulzii-medallion" style={styles.knot} />
          ) : (
            <Icon name={icon} size={ICON_SIZES.md} color={colour} />
          )}
        </View>
        <Text style={[styles.title, { color: colour }]} numberOfLines={2}>{title}</Text>
        {!disabled && (
          <Text style={[styles.chevron, { color: colour }]} accessibilityElementsHidden importantForAccessibility="no">›</Text>
        )}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: SPACE.md,
    marginHorizontal: SPACE.md,
    marginTop: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: SURFACE.panel,
  },
  medallion: {
    ...circle(32),
    borderWidth: 2,
    backgroundColor: SURFACE.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md },
  chevron: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl },
  knot: { width: ICON_SIZES.lg, height: ICON_SIZES.lg },
});
