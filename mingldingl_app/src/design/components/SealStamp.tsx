import { useEffect } from 'react';
import { type ImageStyle, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ArtName } from '../art/manifest';
import { MOTION, useReduceMotion } from '../motion';
import { color, easing } from '../tokens';
import { Art } from './Art';

/**
 * Seal stamp (Figma motion "Seal stamp"): the wax drops from above the page, squashes on the
 * anvil spring and throws a ring of gold dust. `onLand` fires at the impact (haptic and sound).
 * `still` shows it already stamped (a seal seen before).
 */
export function SealStamp({
  name = 'seal_wax',
  size,
  delay = 0,
  onLand,
  still = false,
}: {
  name?: ArtName;
  size: number;
  delay?: number;
  onLand?: () => void;
  still?: boolean;
}) {
  const reduce = useReduceMotion() || still;
  const m = MOTION.sealStamp;
  const fall = Math.round(m.duration * 0.35);
  const drop = useSharedValue(reduce ? 1 : 0);
  const squash = useSharedValue(1);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    const landed = setTimeout(() => onLand?.(), reduce ? 0 : delay + fall);
    if (!reduce) {
      drop.value = withDelay(delay, withTiming(1, { duration: fall }));
      squash.value = withDelay(
        delay + fall,
        withSequence(withTiming(0.88, { duration: 70 }), withSpring(1, easing.anvil)),
      );
      ring.value = withDelay(delay + fall, withTiming(1, { duration: m.duration - fall }));
    }
    return () => clearTimeout(landed);
  }, [drop, squash, ring, reduce, still, delay, fall, onLand]);
  const seal = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 2),
    transform: [
      { scale: (1.9 - 0.9 * drop.value) * squash.value },
      { rotate: `${(1 - drop.value) * -14}deg` },
    ],
  }));
  const dust = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.7 * (1 - ring.value),
    transform: [{ scale: 0.7 + 1.1 * ring.value }],
  }));
  const box = { width: size, height: size };
  return (
    <View style={[box, styles.center]}>
      <Animated.View pointerEvents="none" style={[styles.ring, { ...box, borderRadius: size / 2 }, dust]} />
      <Animated.View style={seal}>
        <Art name={name} style={box as ImageStyle} fit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: color.accentGoldBright },
});
