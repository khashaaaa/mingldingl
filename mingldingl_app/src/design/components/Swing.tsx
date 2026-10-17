import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MOTION, useReduceMotion } from '../motion';

const SWINGS = [14, -11, 8, -5, 2.5, 0];

/**
 * The bell (Figma motion "Bell"): what it holds swings from its top edge and dies down, then
 * waits and rings again. `onRing` fires with the first ring only (haptic and sound).
 */
export function Swing({
  children,
  every = 3200,
  onRing,
  style,
}: {
  children: ReactNode;
  every?: number;
  onRing?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const m = MOTION.bell;
  const angle = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const step = m.duration / SWINGS.length;
    const ease = Easing.inOut(Easing.sin);
    angle.value = withRepeat(
      withSequence(
        ...SWINGS.map((a) => withTiming(a, { duration: step, easing: ease })),
        withDelay(every - m.duration, withTiming(0, { duration: 1 })),
      ),
      -1,
    );
    onRing?.();
    return () => cancelAnimation(angle);
  }, [angle, reduce, every, onRing]);
  const a = useAnimatedStyle(() => ({
    transformOrigin: 'top',
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
