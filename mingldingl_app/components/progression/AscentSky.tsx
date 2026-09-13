import { Fragment, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, Text as SvgText } from 'react-native-svg';
import type { GemTier } from '../../models/user';
import { TIER_ORDER, tierThresholdsSnapshot, tierLabel } from '../../lib/tiers';
import { FONTS, FONT_SIZES, GEM_COLORS, INK, LINE, NIGHT, SPACE, TRACKING } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
  /** Not in the brief's own signature, but the sky is the only place `StreakSummary` used to draw
   *  this number, and the controller ruling still asks for it under the streak block. */
  longestStreak: number;
  width: number;
}

/** Fixed per the brief: "An `Svg` `width × 420`". */
const SKY_HEIGHT = 420;
/** Room at the top for `ascent_beyond` above the last star, and at the bottom for the first. */
const TOP_Y = 76;
const BOTTOM_Y = 372;
/** The climb runs bottom-left to top-right; these are fractions of `width` so the drawing holds
 *  its shape at any card width rather than being authored for one screen size. */
const LEFT_X_RATIO = 0.16;
const RIGHT_X_RATIO = 0.58;

const TOP_INDEX = TIER_ORDER.length - 1;

const STAR_RADIUS = 4;
const DIM_RADIUS = 3;
const HELD_RADIUS = 7;
const HALO_RADIUS = 14;
const HALO_OPACITY_LOW = 0.15;
const HALO_OPACITY_HIGH = 0.35;
/** One full breath (dim → bright → dim) reads as "a star burning", not "a star blinking". */
const PULSE_HALF_MS = 2400;

/**
 * The progression screen's hero: the six gem tiers as stars on a climbing path through the night
 * sky. Replaces the `GemTierBadge` hero + `XPBar` pairing — both a person's rank and how close the
 * next rung is are now the same drawing, rather than a badge next to a bar that repeats it.
 *
 * Geometry is fractional against `width` (measured by the caller via `onLayout`) so the sky holds
 * its shape on any device rather than being authored for one card size.
 */
export function AscentSky({ gemTier, totalScore, currentStreak, longestStreak, width }: Props) {
  const vfxLevel = useVfxLevel();
  const pulse = useRef(new Animated.Value(HALO_OPACITY_LOW)).current;

  useEffect(() => {
    if (!motionAllowed(vfxLevel)) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: HALO_OPACITY_HIGH, duration: PULSE_HALF_MS, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: HALO_OPACITY_LOW, duration: PULSE_HALF_MS, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [vfxLevel, pulse]);

  const heldIndex = TIER_ORDER.indexOf(gemTier);
  const thresholds = tierThresholdsSnapshot();
  const nextTier = heldIndex < TOP_INDEX ? TIER_ORDER[heldIndex + 1] : null;
  const pointsToGo = nextTier ? Math.max(0, thresholds[heldIndex + 1] - totalScore) : null;

  const points = TIER_ORDER.map((tier, i) => ({
    tier,
    x: width * (LEFT_X_RATIO + (RIGHT_X_RATIO - LEFT_X_RATIO) * (i / TOP_INDEX)),
    y: BOTTOM_Y - (BOTTOM_Y - TOP_Y) * (i / TOP_INDEX),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  function labelFor(index: number): string {
    const tier = TIER_ORDER[index];
    const name = tierLabel(tier);
    if (index === heldIndex) {
      return `${name} · ${i18n.t('ascent_you', { score: totalScore.toLocaleString() })}`;
    }
    if (nextTier && index === heldIndex + 1) {
      return `${name} · ${i18n.t('ascent_to_go', { points: pointsToGo!.toLocaleString() })}`;
    }
    const threshold = thresholds[index] ?? 0;
    return threshold > 0 ? `${name} · ${threshold.toLocaleString()}` : name;
  }

  const bodyLine = nextTier
    ? i18n.t('ascent_to_go', { points: pointsToGo!.toLocaleString() })
    : i18n.t('ascent_beyond');
  // The whole drawing is one accessible group (the SVG is hidden, and an `accessible` ancestor
  // suppresses individual announcement of its RN `Text` descendants too) — so the longest-streak
  // line has to be said here, in words, or a screen reader never hears it at all. Reuses
  // `streak_longest`'s own English text rather than adding a key for one more number.
  const a11yLabel = `${tierLabel(gemTier)}. ${totalScore.toLocaleString()}. ${bodyLine}. `
    + `${currentStreak} ${i18n.t('ascent_dawns')}. ${i18n.t('streak_longest')} ${longestStreak}.`;

  const topPoint = points[TOP_INDEX];

  return (
    <View accessible accessibilityLabel={a11yLabel}>
      <Svg width={width} height={SKY_HEIGHT} accessible={false} importantForAccessibility="no">
        <Defs>
          <LinearGradient id="ascentSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NIGHT.black} />
            <Stop offset="1" stopColor={NIGHT.blue} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={SKY_HEIGHT} fill="url(#ascentSky)" />
        <Path d={pathD} stroke={LINE.edge} strokeWidth={1} strokeDasharray="4 4" fill="none" opacity={0.5} />
        <SvgText
          x={topPoint.x}
          y={topPoint.y - 30}
          fill={INK.muted}
          fontFamily={FONTS.bodyItalic}
          fontStyle="italic"
          fontSize={FONT_SIZES.sm}
        >
          {i18n.t('ascent_beyond')}
        </SvgText>
        {points.map((p, i) => {
          const reached = i <= heldIndex;
          const held = i === heldIndex;
          const color = reached ? GEM_COLORS[p.tier] : INK.muted;
          const radius = held ? HELD_RADIUS : reached ? STAR_RADIUS : DIM_RADIUS;
          return (
            <Fragment key={p.tier}>
              {held && (
                motionAllowed(vfxLevel) ? (
                  <AnimatedCircle cx={p.x} cy={p.y} r={HALO_RADIUS} fill={color} opacity={pulse} />
                ) : (
                  <Circle cx={p.x} cy={p.y} r={HALO_RADIUS} fill={color} opacity={0.25} />
                )
              )}
              <Circle testID={held ? 'ascent-star-held' : 'ascent-star'} cx={p.x} cy={p.y} r={radius} fill={color} />
              <SvgText
                x={p.x + radius + SPACE.sm}
                y={p.y + FONT_SIZES.xs / 2}
                fill={reached ? INK.primary : INK.muted}
                fontFamily={FONTS.utility}
                fontSize={FONT_SIZES.xs}
              >
                {labelFor(i)}
              </SvgText>
            </Fragment>
          );
        })}
      </Svg>
      <View style={styles.streakBlock}>
        <Text style={styles.streakNumber}>{currentStreak}</Text>
        <Text style={styles.streakCaption}>{i18n.t('ascent_dawns')}</Text>
        <Text style={styles.longestLine}>{i18n.t('streak_longest')} · {longestStreak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streakBlock: { alignItems: 'center', paddingBottom: SPACE.lg, gap: SPACE.hair },
  streakNumber: { fontFamily: FONTS.display, fontSize: FONT_SIZES.display, color: INK.primary },
  streakCaption: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: INK.dim, letterSpacing: TRACKING.wide },
  longestLine: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.muted, marginTop: SPACE.xs },
});
