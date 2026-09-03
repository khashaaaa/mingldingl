import { useRef, useEffect } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { tierLabel } from '../../lib/tiers';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE, tint } from '../../lib/theme';
import { ORNAMENTS, FRET_ASPECT } from '../../lib/ornaments';
import { GemTierBadge } from './GemTierBadge';
import type { GemTier } from '../../models/user';

interface Props {
  gemTier: GemTier;
  totalScore: number;
  pct: number;
  nextTier: GemTier | null;
  nextTierThreshold?: number | null;
}

export function XPBar({ gemTier, totalScore, pct, nextTier, nextTierThreshold }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-60)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prevPct = useRef(pct);
  const color = colorForTier(gemTier);

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
    shimmer.setValue(-60);
    Animated.timing(shimmer, { toValue: 320, duration: 700, delay: 300, useNativeDriver: true }).start();

    if (pct < prevPct.current) {
      flash.setValue(0.8);
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: true }).start();
    }
    prevPct.current = pct;
  }, [pct]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const pointsToNext = nextTier && nextTierThreshold != null ? Math.max(0, nextTierThreshold - totalScore) : null;

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <View style={styles.tierRow}>
          <GemTierBadge tier={gemTier} size={16} />
          <Text style={[styles.tier, { color }]}>{tierLabel(gemTier)}</Text>
        </View>
        {nextTier && <Text style={styles.next}>→ {tierLabel(nextTier)}</Text>}
      </View>
      <View style={styles.track}>
        <Image source={ORNAMENTS.fretGold} testID="ulzii-track-fret" style={styles.trackFret} />
        {/* Quarter marks belong to the empty road only. Drawn over the fill, the one at 75%
            landed where the gradient turns gold and made a full bar read as three-quarters. */}
        {[0.25, 0.5, 0.75].map((t) => (
          <View key={t} style={[styles.tick, { left: `${t * 100}%` }]} />
        ))}
        <Animated.View style={[styles.fill, { width: fillWidth }]}>
          <LinearGradient
            colors={[color, COLORS.goldBright]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={ORNAMENTS.fretDark} testID="ulzii-fill-fret" style={styles.fillFret} />
          {/* The only vertical edge on the filled stretch, so where the fill ends is never
              in doubt — including at 100%, where there is no dark remainder to contrast with. */}
          <View style={styles.fillCap} />
        </Animated.View>
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmer }] }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      </View>
      <View style={styles.footer}>
        {pointsToNext !== null && (
          <Text style={styles.nextThreshold}>
            {i18n.t('next_tier_threshold', { points: pointsToNext.toLocaleString(), tier: tierLabel(nextTier) })}
          </Text>
        )}
        <Text style={styles.scoreText}>{totalScore.toLocaleString()} {i18n.t('pts')}</Text>
      </View>
    </View>
  );
}

const FILL_BORDER_RADIUS = RADIUS.sm - 1;

const styles = StyleSheet.create({
  container: { gap: SPACE.sm },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  tier: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: 0.5 },
  next: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  track: {
    height: 14,
    backgroundColor: COLORS.panelDeep,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: FILL_BORDER_RADIUS, overflow: 'hidden' },
  // The walking pattern (алхан хээ): faint on the empty road, engraved into the fill.
  trackFret: { position: 'absolute', left: 0, top: 0, height: 12, width: 12 * FRET_ASPECT, opacity: 0.15 },
  fillFret: { position: 'absolute', left: 0, top: 0, height: 12, width: 12 * FRET_ASPECT, opacity: 0.5 },
  fillCap: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: COLORS.text },
  shimmer: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 40,
    backgroundColor: tint(COLORS.text, 0.25),
    transform: [{ skewX: '-20deg' }],
  },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: tint(COLORS.bronze, 0.6) },
  flash: { backgroundColor: COLORS.goldBright },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextThreshold: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, flexShrink: 1 },
  scoreText: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'right', letterSpacing: 1, marginLeft: 'auto' },
});
