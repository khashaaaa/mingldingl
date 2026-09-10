import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { INK, RADIUS, SPACE, tint } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

const LOW = 0.35;
const HIGH = 0.6;
const HELD = (LOW + HIGH) / 2;
const BREATH_MS = 900;

/**
 * One breath for every placeholder on screen.
 *
 * A list skeleton is a dozen blocks, and a dozen `Animated.Value`s each running their own loop
 * is a dozen loops drawing the same opacity — the same waste `Lantern` avoids by giving seven
 * flames one flicker. The value is module-level and reference-counted: the first block to mount
 * starts the breath, the last to unmount stops it.
 */
const breath = new Animated.Value(HELD);
let mounted = 0;
let loop: Animated.CompositeAnimation | null = null;

function acquireBreath(animate: boolean): () => void {
  mounted += 1;
  if (animate && !loop) {
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: LOW, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: HIGH, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
  }
  if (!animate && !loop) breath.setValue(HELD);
  return () => {
    mounted -= 1;
    if (mounted > 0) return;
    loop?.stop();
    loop = null;
    breath.setValue(HELD);
  };
}

function useBreath(): Animated.Value {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  // Re-run only when the level flips, so a re-render never restarts the shared loop.
  const [value] = useState(breath);
  useEffect(() => acquireBreath(animate), [animate]);
  return value;
}

interface Props {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A placeholder in the exact shape of the content that will replace it.
 *
 * The shape is the whole point. Every list in this app used to render a centred spinner and then
 * pop to content, which trades a wait for a layout jump; a block that already occupies the real
 * row's box does not move anything when the data lands.
 */
export function Skeleton({ width, height, radius = RADIUS.sm, style }: Props) {
  const value = useBreath();
  return (
    <Animated.View
      testID="skeleton-block"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, styles.block, { opacity: value }, style]}
    />
  );
}

interface RowsProps {
  count: number;
  gap?: number;
  /** Called once per row. A function, not an element, so each row is a fresh tree. */
  row: () => ReactNode;
}

/** The same row shape repeated — a list of placeholders rather than one. */
export function SkeletonRows({ count, gap = SPACE.md, row }: RowsProps) {
  return (
    <View testID="skeleton-rows" style={{ gap }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{row()}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: tint(INK.primary, 0.13) },
});
