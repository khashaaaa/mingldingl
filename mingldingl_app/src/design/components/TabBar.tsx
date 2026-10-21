import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/lib/feedback';
import { withAlpha } from '../effects';
import type { GlyphName } from '../glyphs';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';
import { Art, Glyph } from './Art';
import { Glow } from './Glow';
import { Txt } from './Txt';

export type Tab = { key: string; label: string; glyph: GlyphName };

/** How far the night fade reaches up over the room above the doors. */
const FADE_ABOVE = dimension.space5;

const NIGHT_FADE = `linear-gradient(to bottom, ${withAlpha(color.bgSunken, 0)}, ${withAlpha(color.bgSunken, 0.8)} 28%, ${withAlpha(color.bgSunken, 0.97)})`;

/**
 * The five doors along the foot of the world. No slab: the night deepens under them so the stars
 * run on beneath, with the room title's dry-brush rule along the top. The open door is gold, lit
 * by the hearth from behind, with a gold lozenge above it.
 */
export function TabBar({
  tabs,
  active,
  onPress,
}: {
  tabs: readonly Tab[];
  active: string;
  onPress: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, dimension.space5) }]}
    >
      <View pointerEvents="none" style={[styles.fade, { experimental_backgroundImage: NIGHT_FADE }]} />
      <Art name="dry_brush_rule" style={styles.edge} fit="stretch" />
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: on }}
            onPressIn={() => feedback('press')}
            onPress={() => onPress(tab.key)}
            style={styles.item}
          >
            <Door on={on}>
              <Glyph name={tab.glyph} size={26} tint={on ? 'textAccent' : 'textMuted'} />
            </Door>
            <Txt
              variant="labelTab"
              color={on ? 'textAccent' : 'textMuted'}
              numberOfLines={1}
              // held to its own fifth of the bar: a long (Mongolian) label shrinks, never runs into the next
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              align="center"
              style={styles.label}
            >
              {tab.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The lozenge and the glyph under it: opening a door grows the lozenge from its middle, kindles the
 * hearth glow behind the glyph and lifts it a point with a small settle; leaving lets the lozenge
 * fade (a shift, M3's 75%).
 */
function Door({ on, children }: { on: boolean; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const lit = useSharedValue(on ? 1 : 0);
  const lift = useSharedValue(0);
  useEffect(() => {
    const m = MOTION.press;
    const d = on ? 240 : 180;
    lit.value = reduce ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: d, easing: curve('forgeOut') });
    if (on && !reduce)
      lift.value = withSequence(
        withTiming(1, { duration: m.duration, easing: curve('forgeOut') }),
        withTiming(0, { duration: 240, easing: curve('breathe') }),
      );
  }, [on, reduce, lit, lift]);
  const mark = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ rotate: '45deg' }, { scale: 0.2 + 0.8 * lit.value }],
  }));
  const glyph = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }, { scale: 1 + 0.08 * lift.value }],
  }));
  return (
    <>
      <View style={styles.mark}>
        <Animated.View testID={on ? 'open-door' : undefined} style={[styles.lozenge, mark]} />
      </View>
      <View>
        {on ? (
          <View style={styles.hearth}>
            <Glow tint={color.accentGold} strength={0.32} breathe={false} />
          </View>
        ) : null}
        <Animated.View style={glyph}>{children}</Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  fade: { position: 'absolute', top: -FADE_ABOVE, left: 0, right: 0, bottom: 0 },
  edge: {
    position: 'absolute',
    top: 0,
    left: dimension.space6,
    right: dimension.space6,
    height: 4,
    opacity: 0.85,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingTop: 10, paddingBottom: dimension.space2 },
  mark: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  lozenge: { width: 6, height: 6, backgroundColor: color.accentGold },
  // the hearth's light spills well past the glyph it sits behind
  hearth: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20 },
  label: { alignSelf: 'stretch', paddingHorizontal: 2 },
});
