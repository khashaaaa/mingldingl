import { View, Text, StyleSheet } from 'react-native';
import type { GemTier } from '../../models/user';
import { TIER_ORDER, colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { AppCard } from '../ui/AppCard';
import { GemTierBadge } from './GemTierBadge';
import { COLORS, FONTS } from '../../lib/theme';

interface Props {
  gemTier: GemTier;
  tierBonus: number;
  nextTier: GemTier | null;
}

export function TierPerkCard({ gemTier, tierBonus, nextTier }: Props) {
  const color = colorForTier(gemTier);
  // Tier index doubles as the flat match-budget bonus (see ScoreService.TierIndex in the engine) — keep in sync if that changes.
  const nextBonus = nextTier ? TIER_ORDER.indexOf(nextTier) : null;

  return (
    <AppCard tier={gemTier} textured style={styles.card}>
      <Text style={styles.label}>{i18n.t('tier_perk_label')}</Text>
      <View style={styles.row}>
        <GemTierBadge tier={gemTier} size={20} />
        <Text style={[styles.bonus, { color }]}>+{tierBonus} {i18n.t('daily_matches')}</Text>
      </View>
      {nextBonus !== null && (
        <Text style={styles.preview}>
          {i18n.t('tier_perk_next_preview', { bonus: nextBonus })}
        </Text>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  label: { fontSize: 10, fontFamily: FONTS.display, color: COLORS.textDim, letterSpacing: 2, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bonus: { fontSize: 18, fontFamily: FONTS.displayBlack },
  preview: { fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.body, marginTop: 8 },
});
