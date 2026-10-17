import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { withAlpha } from '../effects';
import { useReduceMotion } from '../motion';
import { color, duration, easing, effect, type } from '../tokens';

const DIGIT_H = 40;
/** Each place rolls one digit-step after the place to its right, so a carry reads as a carry. */
const STEP_MS = duration.travel;
/** 9, then 0–9 twice: a drum rolls forward past 9 onto the second 0 and is then reset to the first. */
const STRIP = [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const glow = effect.glowGold[0];

/** Digits of n, most significant first, no leading zeros. */
export function drumDigits(n: number): number[] {
  return String(Math.max(0, Math.floor(n)))
    .split('')
    .map(Number);
}

/** Points as a lit gold number whose digits roll. A gain rolls the units first, then each carry. */
export function PointsCounter({ value }: { value: number }) {
  const digits = drumDigits(value);
  const previous = useRef(digits);
  const reduced = useReduceMotion();
  // Read during render, before the effect below moves `previous` on: which drums turn, and when.
  const rank = rollOrder(previous.current, digits);

  // Ticks follow the drums: one per drum that turns, right to left.
  useEffect(() => {
    const now = drumDigits(value);
    const turns = new Set(rollOrder(previous.current, now).values()).size;
    previous.current = now;
    if (reduced) return;
    const timers = Array.from({ length: turns }, (_, k) => setTimeout(() => feedback('press'), k * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [value, reduced]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('points.label', { points: value })}
      style={styles.number}
    >
      {/* Every drum carries a strip of 21 digits; a screen reader must hear the label, not 80+ digits. */}
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {digits.map((d, i) => {
          const place = digits.length - 1 - i;
          return <Drum key={place} digit={d} delay={(rank.get(place) ?? 0) * STEP_MS} reduced={reduced} />;
        })}
      </View>
    </View>
  );
}

/** place (0 = units) → its turn among the drums that change: the k-th turning drum waits k steps. */
function rollOrder(before: number[], after: number[]): Map<number, number> {
  const order = new Map<number, number>();
  for (let place = 0; place < after.length; place++) {
    const a = after[after.length - 1 - place];
    const b = before[before.length - 1 - place] ?? 0;
    if (a !== b) order.set(place, order.size);
  }
  return order;
}

const indexOf = (d: number) => d + 1;

function Drum({ digit, delay, reduced }: { digit: number; delay: number; reduced: boolean }) {
  const pos = useSharedValue(indexOf(digit));
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -pos.value * DIGIT_H }],
  }));

  useEffect(() => {
    const target = indexOf(digit);
    if (reduced) {
      pos.value = target;
      return;
    }
    // Always roll forward: a smaller digit is reached through 9 onto the strip's second run.
    const forward = target < Math.round(pos.value) ? target + 10 : target;
    pos.value = withDelay(
      delay,
      withSpring(forward, easing.anvil, (done) => {
        'worklet';
        if (done && forward > 10) pos.value = forward - 10;
      }),
    );
  }, [digit, delay, reduced, pos]);

  return (
    <View testID={`drum-${digit}`} style={styles.drum}>
      <Animated.View style={style}>
        {STRIP.map((n, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the strip repeats digits by design
          <Text key={i} style={styles.digit} allowFontScaling={false}>
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  number: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row' },
  drum: { width: 22, height: DIGIT_H, overflow: 'hidden' },
  digit: {
    fontFamily: type.numberL.fontFamily,
    fontSize: 34,
    lineHeight: DIGIT_H,
    height: DIGIT_H,
    textAlign: 'center',
    color: color.textAccent,
    textShadowColor: withAlpha(glow.color, glow.opacity),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
