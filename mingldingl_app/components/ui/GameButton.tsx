import { useRef } from 'react';
import { Pressable, Text, Animated, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { BUTTON_METALS, COLORS, FONTS, FONT_SIZES, RADIUS, SPACE, overlay } from '../../lib/theme';
import { Icon } from './Icon';

interface Props {
  children: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'brass';
  size?: 'default' | 'compact';
  icon?: React.ComponentProps<typeof Icon>['name'];
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}


const METAL_VARIANTS = new Set(['primary', 'danger', 'brass']);

const SIZES = {
  default: { minHeight: 52, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.lg, fontSize: FONT_SIZES.md, letterSpacing: 1, iconSize: 15 },
  compact: { minHeight: 44, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, fontSize: FONT_SIZES.sm, letterSpacing: 0.5, iconSize: 14 },
} as const;

export function GameButton({ children, onPress, variant = 'primary', size = 'default', icon, disabled, loading, style, flex }: Props) {
  const pressY = useRef(new Animated.Value(0)).current;
  const isMetal = METAL_VARIANTS.has(variant);
  const sz = SIZES[size];

  function pressIn() {
    Animated.timing(pressY, { toValue: 2, duration: 60, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(pressY, { toValue: 0, useNativeDriver: true, speed: 40 }).start();
  }

  return (
    <Animated.View
      style={[
        { transform: [{ translateY: pressY }] },
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
          { borderColor: BUTTON_METALS[variant].border },
          { minHeight: sz.minHeight, paddingVertical: sz.paddingVertical, paddingHorizontal: sz.paddingHorizontal },
        ]}
      >
        <LinearGradient colors={BUTTON_METALS[variant].gradient} style={StyleSheet.absoluteFill} />
        <View style={[styles.topHighlight, { backgroundColor: BUTTON_METALS[variant].highlight }]} />
        {isMetal && <View style={styles.bottomShadow} />}
        {loading ? (
          <ActivityIndicator color={BUTTON_METALS[variant].label} />
        ) : (
          <View style={styles.labelRow}>
            {icon && <Icon name={icon} size={sz.iconSize} color={BUTTON_METALS[variant].label} />}
            <Text
              style={[styles.label, { color: BUTTON_METALS[variant].label }, { fontSize: sz.fontSize, letterSpacing: sz.letterSpacing }]}

              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {children.toUpperCase()}
            </Text>
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
    shadowColor: COLORS.gold,
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
    backgroundColor: overlay(0.35),
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, maxWidth: '100%' },
  label: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: 1, flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
