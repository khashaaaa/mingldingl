import { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Glyph } from '../ui/Glyph';
import { signal } from '../../lib/world/feedback';
import { i18n } from '../../lib/i18n';
import { ICON_SIZES, METAL, PRESS, SURFACE, tint } from '../../lib/theme';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

const SEAL = 48;

/**
 * The send seal — a disc of wax standing in for a send button, so sending a line is pressing a
 * seal shut rather than tapping a chat icon. Its press-in scale follows `GameButton`'s own (60ms
 * to 0.94, spring back), and it always ticks: this is the one press-per-line moment in the whole
 * ledger, so it earns the same signal every other forged control gets.
 */
export function WaxSealButton({ onPress, disabled }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (!disabled) signal('press');
    Animated.timing(scale, { toValue: 0.94, duration: 60, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('letter_seal')}
        accessibilityState={{ disabled: !!disabled }}
        testID="wax-seal-send"
        style={[styles.disc, disabled && styles.disabled]}
      >
        <Glyph name="seal" size={ICON_SIZES.md} color={tint(SURFACE.sunken, 0.75)} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    backgroundColor: METAL.gold,
    borderWidth: 2,
    borderColor: tint(SURFACE.sunken, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: PRESS.disabled },
});
