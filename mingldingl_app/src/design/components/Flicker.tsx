import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { curve, MOTION, useReduceMotion } from '../motion';

/**
 * A held flame (Figma motion "Candle"): what it holds breathes — a slow swell and an uneven
 * flicker on top — for as long as it is on screen. Stops under Reduce Motion.
 */
export function Flicker({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const m = MOTION.candle;
  const swell = useSharedValue(0);
  const flick = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const ease = curve(m.easing);
    swell.value = withRepeat(withTiming(1, { duration: m.duration / 2, easing: ease }), -1, true);
    // Uneven steps read as a flame, not a pulse.
    flick.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 130 }),
        withTiming(0.2, { duration: 210 }),
        withTiming(1, { duration: 90 }),
        withTiming(0.35, { duration: 260 }),
        withTiming(0, { duration: 180 }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(swell);
      cancelAnimation(flick);
    };
  }, [swell, flick, reduce]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.88 + 0.12 * swell.value - 0.06 * flick.value,
    transform: [{ scale: 1 + 0.025 * swell.value + 0.008 * flick.value }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
