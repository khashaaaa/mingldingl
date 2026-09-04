import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier } from '../../lib/tiers';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE, metalGradient, tint } from '../../lib/theme';
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
          <Icon name="fire" size={ICON_SIZES.xs} color={COLORS.ember} />
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
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    gap: SPACE.xs,
    overflow: 'hidden',
  },
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: tint(COLORS.text, 0.14) },
  score: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: 0.5 },
  pts: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: COLORS.textDim, letterSpacing: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginLeft: SPACE.xs },
  streak: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: COLORS.emberLight, letterSpacing: 1 },
});
