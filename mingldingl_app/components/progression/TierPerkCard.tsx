import { View, Text, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import type { GemTier } from '../../models/user';
import { TIER_ORDER, colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { AppCard } from '../ui/AppCard';
import { GemTierBadge } from './GemTierBadge';
import { BADGE_SIZES, FONTS, FONT_SIZES, INK, SPACE } from '../../lib/theme';
interface Props {
  gemTier: GemTier;
  tierBonus: number;
  nextTier: GemTier | null;
  dailyMatchBudget?: number | null;
}

export function TierPerkCard({ gemTier, tierBonus, nextTier, dailyMatchBudget }: Props) {
  const color = colorForTier(gemTier);

  const nextBonus = nextTier ? TIER_ORDER.indexOf(nextTier) : null;

  return (
    <AppCard tier={gemTier} style={styles.card}>
      <CardEyebrow>{i18n.t('tier_perk_label')}</CardEyebrow>
      <View style={styles.row}>
        <GemTierBadge tier={gemTier} size={BADGE_SIZES.chip} />
        <Text style={[styles.bonus, { color }]}>+{tierBonus} {i18n.t('daily_matches')}</Text>
      </View>
      {dailyMatchBudget != null && (
        <Text style={styles.budget}>{i18n.t('daily_summons_budget', { count: dailyMatchBudget })}</Text>
      )}
      {nextBonus !== null && (
        <Text style={styles.preview}>
          {i18n.t('tier_perk_next_preview', { bonus: nextBonus })}
        </Text>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  bonus: { fontSize: FONT_SIZES.title, fontFamily: FONTS.display },
  budget: { fontSize: FONT_SIZES.md, color: INK.primary, fontFamily: FONTS.bodyMedium, marginTop: SPACE.sm },
  preview: { fontSize: FONT_SIZES.sm, color: INK.dim, fontFamily: FONTS.body, marginTop: SPACE.sm },
});
