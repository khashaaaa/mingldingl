import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { feedback } from '@/lib/feedback';
import { boxShadow } from '../effects';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';

const TRACK_W = 52;
const KNOB = 14; // the lozenge's side; turned 45° it spans ~20
const INSET = 8;

/**
 * Figma's Toggle (22:143): a lozenge riding a cut slot — the name rule's gold lozenge, lit and glowing
 * at the right when on, an unlit iron one at the left when off. No pill, no round knob: it is the
 * screen's own mark, not a phone's switch.
 */
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
    borderColor: interpolateColor(on.value, [0, 1], [color.borderStrong, color.borderGold]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (TRACK_W - KNOB - INSET * 2) }, { rotate: '45deg' }],
    backgroundColor: interpolateColor(on.value, [0, 1], [color.textMuted, color.accentGoldBright]),
  }));
  const lit = useAnimatedStyle(() => ({ opacity: on.value }));

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
        <Animated.View style={[styles.knob, knob]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.glow, lit]} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: 30,
    borderRadius: dimension.radiusSm,
    borderWidth: dimension.strokeHairline,
    backgroundColor: color.bgPanel,
    paddingHorizontal: INSET - 1,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB },
  glow: { boxShadow: boxShadow('glowGold') },
  disabled: { opacity: 0.5 },
});
