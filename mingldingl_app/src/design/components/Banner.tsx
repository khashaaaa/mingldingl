import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { GlyphName } from '../glyphs';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';
import { Art, Glyph } from './Art';
import { Flicker } from './Flicker';
import { type ColorName, Txt } from './Txt';

/**
 * A notice framed in gold with its glyph: the embers before a bond goes cold (Figma 31:262), or a
 * pledge waiting (33:1487). `smoulder` lets its edge burn (Figma motion "Ember flare"): a flare as it
 * appears, then a slow ember glow for as long as it stays. `clasp` is the quiet one — a hairline
 * frame and a brass clasp instead of the glyph (the road is cut, 36:535).
 */
export function Banner({
  text,
  glyph = 'ember',
  tint = 'accentEmber',
  smoulder = false,
  clasp = false,
}: {
  text: string;
  glyph?: GlyphName;
  tint?: ColorName;
  smoulder?: boolean;
  clasp?: boolean;
}) {
  const mark = clasp ? (
    <Art name="clasp" style={styles.clasp} fit="contain" />
  ) : (
    <Glyph name={glyph} size={20} tint={tint} />
  );
  return (
    <View accessible accessibilityRole="alert" style={[styles.banner, clasp && styles.quiet]}>
      {smoulder && <Smoulder />}
      {smoulder ? <Flicker>{mark}</Flicker> : mark}
      <Txt variant="bodyS" style={styles.text}>
        {text}
      </Txt>
    </View>
  );
}

function Smoulder() {
  const reduce = useReduceMotion();
  const m = MOTION.emberFlare;
  const k = useSharedValue(reduce ? 0.5 : 0);
  useEffect(() => {
    if (reduce) return;
    const ease = curve(MOTION.candle.easing);
    k.value = withSequence(
      withTiming(1, { duration: m.duration / 2 }),
      withTiming(0.3, { duration: m.duration }),
      withRepeat(withTiming(0.75, { duration: MOTION.candle.duration, easing: ease }), -1, true),
    );
    return () => cancelAnimation(k);
  }, [k, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: k.value }));
  return <Animated.View pointerEvents="none" style={[styles.burn, a]} />;
}

/** Figma's Section Header: a caps caption with a dry-brush rule running out to the edge ("YOUR TURN ———"). */
export function SectionLabel({ text, flush }: { text: string; flush?: boolean }) {
  return (
    // flush: inside a screen that already keeps the gutter, so the caption lines up with what follows
    <View style={[styles.section, flush && styles.flush]} accessibilityRole="header">
      <Txt variant="labelM" color="textMuted">
        {text.toUpperCase()}
      </Txt>
      <Art name="dry_brush_rule" style={styles.rule} fit="stretch" />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    padding: dimension.space4,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
    backgroundColor: color.bgRaised,
  },
  quiet: { borderColor: color.borderHairline, backgroundColor: color.bgPanel },
  clasp: { width: 30, height: 56 },
  text: { flex: 1 },
  burn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: color.accentEmber,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: 20, // Figma Section Header: 46 tall, caption 20 from the top
    paddingBottom: dimension.space2,
  },
  flush: { paddingHorizontal: 0 },
  rule: { flex: 1, height: 3 },
});
