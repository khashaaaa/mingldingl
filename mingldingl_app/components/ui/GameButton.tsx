import { useRef } from 'react';
import { Pressable, Text, Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { PRESS, ACCENT, BUTTON_METALS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, RADIUS, SCRIM, SPACE, TRACKING, overlay } from '../../lib/theme';
import { Icon } from './Icon';
import { Waiting } from './Waiting';
import { signal } from '../../lib/world/feedback';

interface Props {
  children: string;
  onPress: () => void;
  /**
   * `ink` is not a fifth metal — it is the absence of one. The kit forges exactly one button per
   * screen, so every other action needs a shape that is unmistakably *not* the deed: no gradient,
   * no border, no glow, sentence case rather than the forge's caps, and a drawn hairline under the
   * label. The underline is a `View` rather than `textDecorationLine`, which Android renders at the
   * wrong offset and clips under `adjustsFontSizeToFit`. Everything that makes it a control — the
   * 52pt target, the press tick, `loading`, `disabled`, `icon`, `size`, `flex` — is unchanged.
   */
  variant?: 'primary' | 'ghost' | 'danger' | 'brass' | 'ink';
  size?: 'default' | 'compact';
  icon?: React.ComponentProps<typeof Icon>['name'];
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}

const METAL_VARIANTS = new Set(['primary', 'danger', 'brass']);

const SIZES = {
  default: { minHeight: 52, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.lg, fontSize: FONT_SIZES.md, letterSpacing: TRACKING.wide, iconSize: ICON_SIZES.md },
  compact: { minHeight: 44, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, fontSize: FONT_SIZES.sm, letterSpacing: TRACKING.label, iconSize: ICON_SIZES.sm },
} as const;

export function GameButton({ children, onPress, variant = 'primary', size = 'default', icon, disabled, loading, style, flex }: Props) {
  const pressY = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const isMetal = METAL_VARIANTS.has(variant);
  const metal = variant === 'ink' ? null : BUTTON_METALS[variant];
  const labelColor = metal ? metal.label : INK.primary;
  const sz = SIZES[size];

  function pressIn() {
    if (!disabled && !loading) signal('press');
    Animated.parallel([
      Animated.timing(pressY, { toValue: 2, duration: 60, useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
    ]).start();
  }
  function pressOut() {
    Animated.parallel([
      Animated.spring(pressY, { toValue: 0, useNativeDriver: true, speed: 40 }),
      Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }

  return (
    <Animated.View
      style={[
        { transform: [{ translateY: pressY }, { scale: pressScale }] },
        flex !== undefined && { flex },
        variant === 'primary' && styles.forgeGlow,
        style,
        disabled && styles.disabled,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
        style={[
          styles.slab,
          metal ? { borderColor: metal.border } : styles.inkSlab,
          { minHeight: sz.minHeight, paddingVertical: sz.paddingVertical, paddingHorizontal: sz.paddingHorizontal },
        ]}
      >
        {metal && <LinearGradient colors={metal.gradient} style={StyleSheet.absoluteFill} />}
        {metal && <View style={[styles.topHighlight, { backgroundColor: metal.highlight }]} />}
        {isMetal && <View style={styles.bottomShadow} />}
        {loading ? (
          <Waiting color={labelColor} />
        ) : (
          <View style={styles.labelRow}>
            {icon && <Icon name={icon} size={sz.iconSize} color={labelColor} />}
            <View style={styles.labelStack}>
              <Text
                style={[styles.label, { color: labelColor }, { fontSize: sz.fontSize, letterSpacing: sz.letterSpacing }]}

                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {metal ? children.toUpperCase() : children}
              </Text>
              {!metal && <View testID="ink-underline" style={styles.inkUnderline} />}
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slab: {
    minHeight: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    overflow: 'hidden',
  },
  forgeGlow: {
    shadowColor: ACCENT.base,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  topHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
  },
  bottomShadow: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: overlay(SCRIM.edge),
  },
  inkSlab: { borderColor: 'transparent', backgroundColor: 'transparent' },
  // Stretched rather than centred: the rule is the width of the label it underlines, and a `Text`
  // shrunk by `adjustsFontSizeToFit` still lays out at its measured width inside this stack.
  labelStack: { alignItems: 'stretch', flexShrink: 1 },
  inkUnderline: { height: 1, marginTop: SPACE.hair, backgroundColor: LINE.edge },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, maxWidth: '100%' },
  label: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: TRACKING.wide, flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: PRESS.disabled },
});
