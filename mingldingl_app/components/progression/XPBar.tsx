import { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { GemTierBadge } from './GemTierBadge';
import type { GemTier } from '../../models/user';

interface Props {
  gemTier: GemTier;
  totalScore: number;
  pct: number;
  nextTier: GemTier | null;
}

export function XPBar({ gemTier, totalScore, pct, nextTier }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-60)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prevPct = useRef(pct);
  const color = colorForTier(gemTier);

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
    shimmer.setValue(-60);
    Animated.timing(shimmer, { toValue: 320, duration: 700, delay: 300, useNativeDriver: true }).start();
    // pct dropping means the user crossed into a new tier: flash bright gold
    if (pct < prevPct.current) {
      flash.setValue(0.8);
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: true }).start();
    }
    prevPct.current = pct;
  }, [pct]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <View style={styles.tierRow}>
          <GemTierBadge tier={gemTier} size={16} />
          <Text style={[styles.tier, { color }]}>{gemTier}</Text>
        </View>
        {nextTier && <Text style={styles.next}>→ {nextTier}</Text>}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillWidth }]}>
          <LinearGradient
            colors={[color, COLORS.goldBright]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmer }] }]} />
        {[0.25, 0.5, 0.75].map((t) => (
          <View key={t} style={[styles.tick, { left: `${t * 100}%` }]} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      </View>
      <Text style={styles.scoreText}>{totalScore.toLocaleString()} {i18n.t('pts')}</Text>
    </View>
  );
}

const FILL_BORDER_RADIUS = RADIUS.sm - 1;

const styles = StyleSheet.create({
  container: { gap: 8 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tier: { fontFamily: FONTS.display, fontSize: 13, letterSpacing: 0.5 },
  next: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  track: {
    height: 14,
    backgroundColor: COLORS.panelDeep,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: FILL_BORDER_RADIUS, overflow: 'hidden' },
  shimmer: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 40,
    backgroundColor: 'rgba(237,228,211,0.25)',
    transform: [{ skewX: '-20deg' }],
  },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(74,90,107,0.6)' },
  flash: { backgroundColor: COLORS.goldBright },
  scoreText: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.textDim, textAlign: 'right', letterSpacing: 1 },
});
