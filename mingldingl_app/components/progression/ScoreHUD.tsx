import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier } from '../../lib/tiers';
import { COLORS, FONTS, RADIUS, metalGradient, tint } from '../../lib/theme';
import { GemTierBadge } from './GemTierBadge';
import { Icon } from '../ui/Icon';

interface Props {
  score: number;
  tier?: string;
  streak?: number;
}

export function ScoreHUD({ score, tier = 'Garnet', streak }: Props) {
  const color = colorForTier(tier);
  return (
    <View style={[styles.slab, { borderColor: color + '66' }]}>
      <LinearGradient colors={metalGradient(COLORS.panelDeep)} style={StyleSheet.absoluteFill} />
      <View style={styles.topHighlight} pointerEvents="none" />
      <GemTierBadge tier={tier} size={16} />
      <Text style={[styles.score, { color }]}>{score.toLocaleString()}</Text>
      <Text style={styles.pts}>XP</Text>
      {streak !== undefined && streak >= 2 && (
        <View style={styles.streakRow}>
          <Icon name="fire" size={12} color={COLORS.ember} />
          <Text style={styles.streak}>{streak}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    overflow: 'hidden',
  },
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: tint(COLORS.text, 0.14) },
  score: { fontFamily: FONTS.display, fontSize: 14, letterSpacing: 0.5 },
  pts: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 },
  streak: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.emberLight, letterSpacing: 0.5 },
});
