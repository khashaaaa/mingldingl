import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { ORNAMENTS } from '../../lib/ornaments';
import { ACCENT, ICON_SIZES } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  size?: number;
  /** Tints the knot, so a button can pass its own label metal. */
  color?: string;
}

const SPIN_MS = 1400;
/** A knot held still is an ornament, not a waiter, so `still` dims it to read as inert. */
const STILL_OPACITY = 0.5;

/**
 * The short wait: the ulzii knot turning.
 *
 * Replaces `ActivityIndicator` wherever a wait is a moment rather than an event — a button
 * submitting, a photo uploading. The knot is `ORNAMENTS.knotGold` tinted through `Image`, not a
 * drawn path, because there is no `react-native-svg` here and Skia cannot mount on web.
 *
 * It carries no text label deliberately: the only string available would be English (the house
 * rule forbids guessed Mongolian), and an English word read aloud to a Mongolian speaker is
 * worse than the platform's own localised "progress bar" from `accessibilityRole`.
 */
export function Waiting({ size = ICON_SIZES.lg, color = ACCENT.base }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.Image
      testID="waiting-knot"
      source={ORNAMENTS.knotGold}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      aria-busy
      style={[
        { width: size, height: size, tintColor: color },
        animate ? { transform: [{ rotate }] } : styles.still,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  still: { opacity: STILL_OPACITY },
});
