import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AlertModal } from '../components/modals/AlertModal';
import { AppCard } from '../components/ui/AppCard';
import { ChoiceRow } from '../components/ui/ChoiceRow';
import { GameButton } from '../components/ui/GameButton';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useMembership } from '../hooks/useMembership';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { COLORS, FONTS, FONT_SIZES, INK, SPACE } from '../lib/theme';
import { membershipLabel } from '../lib/tiers';
import type { GemTier } from '../models/user';
import type { MembershipPriceOption } from '../models/membership';
import { useScrollTail } from '../hooks/useScrollTail';


const BADGE_TIER: Record<string, GemTier> = {
  Free: 'Garnet', Silver: 'Opal', Gold: 'Emerald',
};

const BADGE_COLOR: Record<string, { color: string; shade: string }> = {
  Free: { color: INK.muted, shade: COLORS.bronzeDark },
  Silver: { color: COLORS.silver, shade: COLORS.silverDark },
  Gold: { color: COLORS.goldBright, shade: COLORS.gold },
};

const DURATIONS = ['1', '3', '6'] as const;
const DURATION_LABEL_KEY: Record<(typeof DURATIONS)[number], string> = {
  '1': 'duration_1_month', '3': 'duration_3_months', '6': 'duration_6_months',
};

export default function MembershipScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { currentLevel, expiresAt, isLoading: membershipLoading, tiers, tiersLoading, upgrade, isUpgrading, upgradeError } = useMembership();
  const [selectedTier, setSelectedTier] = useState<string>(currentLevel ?? 'Free');
  const [selectedDuration, setSelectedDuration] = useState<(typeof DURATIONS)[number]>('1');

  useEffect(() => {
    if (currentLevel) setSelectedTier(currentLevel);
  }, [currentLevel]);

  const [showUpgradeError, setShowUpgradeError] = useState(false);
  useEffect(() => {
    if (upgradeError) setShowUpgradeError(true);
  }, [upgradeError]);

  function priceOptionFor(t: { prices: MembershipPriceOption[] }): MembershipPriceOption | undefined {
    return t.prices.find((p) => p.durationMonths === Number(selectedDuration));
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={i18n.t('guild_ranks')} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tail }]}>
        <Text style={styles.subtitle}>
          {i18n.t('guild_ranks_sub')}
        </Text>
        {currentLevel && currentLevel !== 'Free' && expiresAt && (
          <Text style={styles.expiryLine}>
            {i18n.t('membership_active_until', { date: formatDate(expiresAt) })}
          </Text>
        )}
        {tiersLoading && <ActivityIndicator color={COLORS.gold} />}
        {tiers.map((t) => {
          const isSelected = selectedTier === t.level;
          const isCurrent = currentLevel === t.level;
          const gemTier = BADGE_TIER[t.level] ?? 'Garnet';
          const badgeColor = BADGE_COLOR[t.level] ?? BADGE_COLOR.Free;
          const priceOption = priceOptionFor(t);
          const priceLabel = t.monthlyPriceMnt === null
            ? i18n.t('price_free')
            : i18n.t('price_per_month', { amount: (priceOption?.pricePerMonthMnt ?? t.monthlyPriceMnt).toLocaleString() });
          const totalPriceLabel = priceOption && priceOption.durationMonths > 1
            ? i18n.t('price_total', { amount: priceOption.totalPriceMnt.toLocaleString() })
            : null;
          return (
            <TouchableOpacity
              key={t.level}
              onPress={() => setSelectedTier(t.level)}
              activeOpacity={0.85}
              style={isSelected ? styles.selectedGlow : undefined}
            >
              <AppCard
                tier={gemTier}
                tint={badgeColor.color}
                textured
                style={[
                  styles.tierCard,
                  isSelected && styles.tierCardSelected,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.crestRow}>
                    <GemTierBadge tier={gemTier} size={30} color={badgeColor.color} shade={badgeColor.shade} />
                    <View>
                      <Text style={styles.tierName}>{membershipLabel(t.level)}</Text>
                      {isCurrent && <Text style={styles.currentBadge}>{i18n.t('current_rank')}</Text>}
                    </View>
                  </View>
                  <View style={styles.priceColumn}>
                    <Text style={styles.tierPrice}>{priceLabel}</Text>
                    {totalPriceLabel && <Text style={styles.totalPriceLabel}>{totalPriceLabel}</Text>}
                    {priceOption && priceOption.discountPct > 0 && (
                      <Text style={styles.saveBadge}>{i18n.t('save_percent', { percent: priceOption.discountPct })}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.perkList}>
                  <View style={styles.perkRow}>
                    <Text style={styles.perkCheck}>✦</Text>
                    <Text style={styles.perkLabel}>{i18n.t('daily_matches_count', { n: t.dailyMatches })}</Text>
                  </View>
                  {t.featureKeys.map((key) => (
                    <View key={key} style={styles.perkRow}>
                      <Text style={styles.perkCheck}>✦</Text>
                      {/* Feature keys come from the engine's tier table, so one can arrive
                          before its translation does — degrade to the readable key rather than
                          printing i18n-js's missing-translation marker on a paid upgrade card. */}
                      <Text style={styles.perkLabel}>
                        {i18n.t(`perk_${key}`, { defaultValue: key.replace(/_/g, ' ') })}
                      </Text>
                    </View>
                  ))}
                </View>
              </AppCard>
            </TouchableOpacity>
          );
        })}
        {selectedTier !== 'Free' && (
          <ChoiceRow
            label={i18n.t('billing_cycle')}
            value={selectedDuration}
            options={DURATIONS}
            optionLabel={(opt) => i18n.t(DURATION_LABEL_KEY[opt])}
            onChange={setSelectedDuration}
          />
        )}
        <View style={styles.buttonWrap}>
          <GameButton
            variant="primary"
            onPress={() => upgrade(selectedTier, Number(selectedDuration))}
            disabled={membershipLoading || (selectedTier === 'Free' && currentLevel === 'Free')}
            loading={isUpgrading}
          >
            {i18n.t(
              selectedTier === currentLevel && selectedTier !== 'Free' ? 'renew_tier' : 'upgrade_to',
              // The tier cards localise their names, so the call to action has to as well —
              // interpolating the raw enum produced "SILVER СУНГАХ" next to a card reading "Мөнгөн".
              { tier: membershipLabel(selectedTier) },
            )}
          </GameButton>
        </View>
      </ScrollView>
      <AlertModal
        visible={showUpgradeError}
        tone="warning"
        title={i18n.t('upgrade_unavailable_title')}
        message={i18n.t('upgrade_unavailable_body')}
        onDismiss={() => setShowUpgradeError(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: SPACE.gutter,
    paddingTop: SPACE.lg,
    gap: SPACE.lg,
    paddingBottom: SPACE.scrollTail,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    marginBottom: SPACE.xs,
  },
  expiryLine: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.bodyMedium,
    marginBottom: SPACE.xs,
  },
  tierCard: {
    padding: SPACE.xl,
  },
  tierCardSelected: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  selectedGlow: {
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACE.lg,
  },
  crestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  tierName: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xl,
    fontFamily: FONTS.display,
    letterSpacing: 0.3,
  },
  currentBadge: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.bodyMedium,
    marginTop: SPACE.hair,
    letterSpacing: 0.5,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.xl,
    fontFamily: FONTS.bodyBold,
  },
  saveBadge: {
    color: COLORS.goldBright,
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.bodyMedium,
    marginTop: SPACE.hair,
  },
  totalPriceLabel: {
    color: COLORS.textDim,
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.body,
    marginTop: SPACE.hair,
  },
  perkList: {
    gap: SPACE.sm,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  perkCheck: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.bodyBold,
    width: 16,
  },
  perkLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
  },
  buttonWrap: {
    marginTop: SPACE.sm,
  },
});
