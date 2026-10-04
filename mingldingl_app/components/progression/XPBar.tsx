import { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { tierLabel } from '../../lib/tiers';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { BADGE_SIZES, CARVING, FONTS, FONT_SIZES, INK, SPACE, TRACKING, lighten, tint } from '../../lib/theme';
import { GemTierBadge } from './GemTierBadge';
import { CountText } from '../ui/CountText';
import { BRUSH_TRAIL } from '../ui/brushImages';
import type { GemTier } from '../../models/user';

// Stands in for the number inside a translated sentence, so the sentence keeps its own word
// order in every language and only the number is swapped for a counting one.
const SLOT = '￼';

/** The stroke's height on the sheet, in points. */
const TRAIL_HEIGHT = 10;
/** The ink runs out along the trail over this long, the first time it is seen. */
const FILL_MS = 900;

interface Props {
  gemTier: GemTier;
  totalScore: number;
  pct: number;
  nextTier: GemTier | null;
  nextTierThreshold?: number | null;
}

/**
 * The way to the next stone, as one dry-brushed stroke (`scripts/gen-brush.js`): laid bare across
 * the sheet, then inked over in the stone you hold as far as the score has come. The stone you are
 * walking toward waits, unlit, at the far end — a bar said how full; a trail says where to.
 *
 * It was a tiled Greek-key strip with a sheen, then a trail of pecked marks like the floor's
 * friezes; the brush is the glyphs' own hand, which the rest of the sheet is drawn in.
 */
export function XPBar({ gemTier, totalScore, pct, nextTier, nextTierThreshold }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const color = colorForTier(gemTier);
  const lit = lighten(color, 0.25);
  const animate = motionAllowed(useVfxLevel());
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!animate) {
      anim.setValue(pct);
      return;
    }
    Animated.timing(anim, { toValue: pct, duration: FILL_MS, useNativeDriver: true }).start();
  }, [pct, animate, anim]);

  const pointsToNext = nextTier && nextTierThreshold != null ? Math.max(0, nextTierThreshold - totalScore) : null;
  const [nextBefore, nextAfter] = pointsToNext !== null
    ? i18n.t('next_tier_threshold', { points: SLOT, tier: tierLabel(nextTier) }).split(SLOT)
    : ['', ''];

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <View style={styles.tierRow}>
          <GemTierBadge tier={gemTier} size={BADGE_SIZES.inline} />
          <Text style={[styles.tier, { color }]}>{tierLabel(gemTier)}</Text>
        </View>
        {nextTier && (
          <View style={styles.tierRow}>
            <Text style={styles.next}>{tierLabel(nextTier)}</Text>
            {/* Not yet held, so not yet lit: the badge at rest, set back into the rock. */}
            <View style={styles.unheld}>
              <GemTierBadge tier={nextTier} size={BADGE_SIZES.inline} />
            </View>
          </View>
        )}
      </View>
      <View
        testID="xp-trail"
        style={styles.trail}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        {width > 0 && (
          <>
            <Animated.Image source={BRUSH_TRAIL} resizeMode="stretch" style={[styles.stroke, { width, tintColor: tint(CARVING.stone, 0.3) }]} />
            {/* The inked part: a window slid in from the left as far as the score, with the
                stroke inside it slid back the other way so it stays put — both on the native
                driver, which cannot animate a width. */}
            <Animated.View
              testID="xp-trail-lit"
              style={[styles.lit, { width, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }] }]}
            >
              <Animated.Image
                source={BRUSH_TRAIL}
                resizeMode="stretch"
                style={[styles.stroke, { width, tintColor: lit, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] }]}
              />
            </Animated.View>
          </>
        )}
      </View>
      <View style={styles.footer}>
        {pointsToNext !== null && (
          <Text style={styles.nextThreshold}>
            {nextBefore}<CountText value={pointsToNext} />{nextAfter}
          </Text>
        )}
        <Text style={styles.scoreText}><CountText value={totalScore} /> {i18n.t('pts')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACE.sm },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  tier: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: TRACKING.label },
  next: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  unheld: { opacity: 0.35 },
  trail: { height: TRAIL_HEIGHT, overflow: 'hidden' },
  stroke: { height: TRAIL_HEIGHT },
  lit: { position: 'absolute', top: 0, left: 0, height: TRAIL_HEIGHT, overflow: 'hidden' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextThreshold: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim, flexShrink: 1 },
  scoreText: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: INK.dim, textAlign: 'right', letterSpacing: TRACKING.wide, marginLeft: 'auto' },
});
