import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier } from '../../lib/tiers';
import { ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, HEAT, ICON_SIZES, INK, METAL, RADIUS, SPACE, STATUS, SURFACE, TRACKING, metalGradient, tint } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { GemTierBadge } from './GemTierBadge';
import { CountText } from '../ui/CountText';
import { Icon } from '../ui/Icon';

interface Props {
  score: number;
  tier?: string;
  streak?: number;
}

const FLOAT_RISE = 18;
const FLOAT_MS = 900;

export function ScoreHUD({ score, tier = 'Garnet', streak }: Props) {
  const color = colorForTier(tier);
  const level = useVfxLevel();
  const prevScore = useRef(score);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);
  const float = useRef(new Animated.Value(0)).current;
  // Where the score sits inside the slab, so the delta rises from the number itself and not
  // from the slab's corner.
  const [scoreBox, setScoreBox] = useState<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const diff = score - prevScore.current;
    prevScore.current = score;
    if (diff === 0 || !motionAllowed(level)) return;

    setDelta({ n: diff, key: Date.now() });
    float.setValue(0);
    const rise = Animated.timing(float, {
      toValue: 1,
      duration: FLOAT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    rise.start(({ finished }) => { if (finished) setDelta(null); });
    return () => rise.stop();
    // `level` is read, not reacted to: a reduce-motion toggle should not float the same change twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, float]);

  const onScoreLayout = (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setScoreBox((prev) => (prev && prev.x === x && prev.width === width ? prev : { x, width }));
  };

  return (
    // The slab clips to its rounded edge, so the delta lives on this unclipped wrapper and is
    // free to rise out of the top.
    <View style={styles.wrap}>
      <View style={[styles.slab, { borderColor: tint(color, 0.4) }]}>
        <LinearGradient colors={metalGradient(SURFACE.sunken)} style={StyleSheet.absoluteFill} />
        <View style={styles.topHighlight} pointerEvents="none" />
        <GemTierBadge tier={tier} size={BADGE_SIZES.inline} />
        <CountText value={score} style={[styles.score, { color }]} onLayout={onScoreLayout} />
        <Text style={styles.pts}>XP</Text>
        {streak !== undefined && streak >= 2 && (
          <View style={styles.streakRow}>
            <Icon name="fire" size={ICON_SIZES.xs} color={METAL.ember} />
            <Text style={styles.streak}>{streak}</Text>
          </View>
        )}
      </View>
      {delta && (
        <Animated.Text
          key={delta.key}
          testID="score-delta"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.delta,
            scoreBox ? { left: scoreBox.x, width: scoreBox.width } : styles.deltaUnmeasured,
            {
              color: delta.n > 0 ? ACCENT.base : STATUS.danger,
              opacity: float.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_RISE] }) }],
            },
          ]}
        >
          {delta.n > 0 ? `+${delta.n.toLocaleString()}` : `−${Math.abs(delta.n).toLocaleString()}`}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  slab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    gap: SPACE.xs,
    overflow: 'hidden',
  },
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: tint(INK.primary, 0.14) },
  score: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: TRACKING.label },
  pts: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: INK.dim, letterSpacing: TRACKING.wide },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginLeft: SPACE.xs },
  streak: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: HEAT.flame, letterSpacing: TRACKING.wide },
  delta: {
    position: 'absolute',
    top: 0,
    textAlign: 'center',
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    letterSpacing: TRACKING.label,
  },
  deltaUnmeasured: { left: 0, right: 0 },
});
