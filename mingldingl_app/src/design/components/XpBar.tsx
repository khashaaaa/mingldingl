import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { t, tLine } from '@/lib/i18n';
import { boxShadow } from '../effects';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color, dimension } from '../tokens';
import { Art } from './Art';
import { GEM, type Tier } from './GemBadge';
import { PointsCounter } from './PointsCounter';
import { Txt } from './Txt';

const FILL = `linear-gradient(to right, ${color.accentEmber}, ${color.accentGold} 55%, ${color.accentGoldBright})`;

/**
 * Points as a lit number, the next gem and what it costs, and a gold track with a glowing tip.
 * The gold is drawn along the track when it is shown and glides to each new value (dry-brush draw).
 */
export function XpBar({
  points,
  progress,
  next,
}: {
  points: number;
  /** 0–1 toward the next tier. */
  progress: number;
  /** Null at the top tier. */
  next: { points: number; tier: Tier } | null;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const reduce = useReduceMotion();
  const drawn = useSharedValue(reduce ? p : 0);
  useEffect(() => {
    const m = MOTION.dryBrushDraw;
    drawn.value = reduce
      ? p
      : withDelay(m.duration / 2, withTiming(p, { duration: m.duration * 2, easing: curve(m.easing) }));
  }, [p, reduce, drawn]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${drawn.value * 100}%` }));
  const tipStyle = useAnimatedStyle(() => ({
    left: `${drawn.value * 100}%`,
    opacity: drawn.value > 0 ? 1 : 0,
  }));
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <View style={styles.count}>
          <PointsCounter value={points} />
          <Txt variant="labelS" color="textMuted" style={styles.unit}>
            {t('character.points')}
          </Txt>
        </View>
        {next && (
          <View style={styles.next}>
            {/* one line by design: Android rounds an exact-fit width down and wraps the last word
                out of sight ("195 to Amethyst" needs 270.5 px of a 271 px box) */}
            <Txt variant="voiceM" color="textSecondary" numberOfLines={1} style={styles.nextText}>
              {tLine('xp.toNext', { tier: `tier.${next.tier}` }, { points: next.points })}
            </Txt>
            <Art name={GEM[next.tier]} style={styles.gem} fit="contain" />
          </View>
        )}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
        style={[styles.track, { boxShadow: boxShadow('insetCarved') }]}
      >
        {p > 0 && (
          <Animated.View
            testID="xp-fill"
            style={[styles.fill, { experimental_backgroundImage: FILL }, fillStyle]}
          />
        )}
        {p > 0 && <Animated.View style={[styles.tip, { boxShadow: boxShadow('glowGold') }, tipStyle]} />}
      </View>
    </View>
  );
}

const TRACK_H = 8;
const TIP = 12;

const styles = StyleSheet.create({
  bar: { gap: dimension.space2, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  count: { flexDirection: 'row', alignItems: 'flex-end', gap: dimension.space2 },
  unit: { letterSpacing: 1.5, marginBottom: 8 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space1,
    flexShrink: 1,
    marginLeft: dimension.space2,
    marginBottom: 6,
  },
  nextText: { flexShrink: 1 },
  gem: { width: 20, height: 20 },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: color.bgSunken,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
  },
  fill: { height: '100%', borderRadius: TRACK_H / 2 },
  tip: {
    position: 'absolute',
    top: (TRACK_H - TIP) / 2 - dimension.strokeHairline,
    width: TIP,
    height: TIP,
    marginLeft: -TIP / 2,
    borderRadius: TIP / 2,
    backgroundColor: color.accentGoldBright,
  },
});
