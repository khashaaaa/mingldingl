import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { feedback } from '@/lib/feedback';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color } from '../tokens';

const TRACK_W = 52;
const KNOB = 22;
const INSET = 4;

/** Figma's Toggle (22:143): a forged lever — bronze track and gold knob when on, a sunken slot when off. */
export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const reduce = useReduceMotion();
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = reduce
      ? value
        ? 1
        : 0
      : withTiming(value ? 1 : 0, { duration: MOTION.press.duration, easing: curve(MOTION.press.easing) });
  }, [value, reduce, on]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [color.bgSunken, color.metalBronze]),
    borderColor: interpolateColor(on.value, [0, 1], [color.borderHairline, color.borderGold]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (TRACK_W - KNOB - INSET * 2) }],
    backgroundColor: interpolateColor(on.value, [0, 1], [color.textMuted, color.accentGoldBright]),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPressIn={() => feedback('press')}
      onPress={() => onChange(!value)}
    >
      <Animated.View style={[styles.track, track, disabled && styles.disabled]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    padding: INSET - 1,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  disabled: { opacity: 0.5 },
});
