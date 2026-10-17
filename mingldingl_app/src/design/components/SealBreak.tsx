import { useEffect } from 'react';
import { type ImageStyle, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MOTION, useReduceMotion } from '../motion';
import { color, easing } from '../tokens';
import { Art } from './Art';

const CHIPS = 12;
/** Share of the motion spent straining before the wax gives. */
const STRAIN = 0.4;

/**
 * Seal break (Figma motion "Seal break"): the whole wax strains and trembles, then gives — the
 * broken seal snaps into place and chips of wax fly off and fall. `onBreak` fires as it gives.
 */
export function SealBreak({
  size,
  delay = 0,
  onBreak,
}: {
  size: number;
  delay?: number;
  onBreak?: () => void;
}) {
  const reduce = useReduceMotion();
  const m = MOTION.sealBreak;
  const strain = Math.round(m.duration * STRAIN);
  const shake = useSharedValue(0);
  const gone = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(1);
  const fly = useSharedValue(0);
  const flash = useSharedValue(0);
  useEffect(() => {
    const gave = setTimeout(() => onBreak?.(), reduce ? 0 : delay + strain);
    if (!reduce) {
      shake.value = withDelay(delay, withTiming(1, { duration: strain }));
      gone.value = withDelay(delay + strain, withTiming(1, { duration: 1 }));
      pop.value = withDelay(
        delay + strain,
        withSequence(withTiming(1.18, { duration: 50 }), withSpring(1, easing.anvil)),
      );
      fly.value = withDelay(delay + strain, withTiming(1, { duration: m.duration - strain + 300 }));
      flash.value = withDelay(delay + strain, withTiming(1, { duration: m.duration - strain }));
    }
    return () => clearTimeout(gave);
  }, [shake, gone, pop, fly, flash, reduce, delay, strain, onBreak]);

  const whole = useAnimatedStyle(() => {
    // A tremble that grows as the wax strains.
    const k = shake.value;
    const jitter = Math.sin(k * 70) * 4 * k;
    return {
      opacity: 1 - gone.value,
      transform: [{ translateX: jitter }, { rotate: `${jitter * 0.8}deg` }, { scale: 1 + 0.16 * k }],
    };
  });
  const broken = useAnimatedStyle(() => ({ opacity: gone.value, transform: [{ scale: pop.value }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: flash.value === 0 ? 0 : 0.8 * (1 - flash.value),
    transform: [{ scale: 0.8 + 1.6 * flash.value }],
  }));
  const box = { width: size, height: size };
  return (
    <View style={[box, styles.center]}>
      <Animated.View pointerEvents="none" style={[styles.ring, { ...box, borderRadius: size / 2 }, ring]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, broken]}>
        <Art name="seal_broken" style={box as ImageStyle} fit="contain" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, whole]}>
        <Art name="seal_wax" style={box as ImageStyle} fit="contain" />
      </Animated.View>
      {!reduce &&
        // biome-ignore lint/suspicious/noArrayIndexKey: the chips are a fixed set, never reordered
        Array.from({ length: CHIPS }, (_, i) => <Chip key={i} i={i} t={fly} reach={size} />)}
    </View>
  );
}

function Chip({ i, t, reach }: { i: number; t: SharedValue<number>; reach: number }) {
  // Fixed per chip: an angle round the seal, a speed and a size, so every break looks alike.
  const angle = (i / CHIPS) * Math.PI * 2 + (i % 3) * 0.35;
  const speed = 0.55 + ((i * 37) % 10) / 22;
  const side = 6 + ((i * 53) % 6);
  const s = useAnimatedStyle(() => {
    const k = t.value;
    const d = k * reach * speed;
    return {
      opacity: k === 0 ? 0 : 1 - k,
      transform: [
        { translateX: Math.cos(angle) * d },
        // Gravity: the chips arc downward as they fly.
        { translateY: Math.sin(angle) * d + k * k * reach * 0.9 },
        { rotate: `${k * 400 * (i % 2 ? 1 : -1)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chip,
        { width: side, height: side * 0.8, backgroundColor: i % 3 ? color.sealWax : color.sealWaxLight },
        s,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', borderRadius: 2 },
  ring: { position: 'absolute', borderWidth: 3, borderColor: color.accentGoldBright },
});
