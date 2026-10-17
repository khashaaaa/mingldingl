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
import type { GlyphName } from '../glyphs';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

export type Tab = { key: string; label: string; glyph: GlyphName };

/** The five doors along the foot of the world. The open one is gold with an ember tick above it. */
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
 * The ember tick and the glyph under it: opening a door draws the tick out from its middle and
 * lifts the glyph a point with a small settle; leaving lets the tick fade (a shift, M3's 75%).
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
  const tick = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scaleX: 0.2 + 0.8 * lit.value }],
  }));
  const glyph = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }, { scale: 1 + 0.08 * lift.value }],
  }));
  return (
    <>
      <View style={styles.tick}>
        <Animated.View testID={on ? 'ember-tick' : undefined} style={[styles.ember, tick]} />
      </View>
      <Animated.View style={glyph}>{children}</Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.bgSunken,
    borderTopWidth: dimension.strokeHairline,
    borderTopColor: color.borderHairline,
  },
  item: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: dimension.space2 },
  tick: { width: 18, height: 2 },
  ember: { flex: 1, backgroundColor: color.accentEmber },
  label: { alignSelf: 'stretch', paddingHorizontal: 2 },
});
