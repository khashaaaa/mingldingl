import { useState, useEffect } from 'react';
import { Tap } from '../components/ui/Tap';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { AlertModal } from '../components/modals/AlertModal';
import { AppCard } from '../components/ui/AppCard';
import { CardEyebrow } from '../components/ui/CardEyebrow';
import { ChoiceRow } from '../components/ui/ChoiceRow';
import { GameButton } from '../components/ui/GameButton';
import { HeaderBar } from '../components/ui/HeaderBar';
import { Waiting } from '../components/ui/Waiting';
import { useMembership } from '../hooks/useMembership';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { ACCENT, FONTS, FONT_SIZES, INK, LINE, MEMBERSHIP_METALS, SPACE, TRACKING } from '../lib/theme';
import type { MembershipTier } from '../models/membership';
import { useScrollTail } from '../hooks/useScrollTail';

const DURATIONS = ['1', '3', '6'] as const;
const DURATION_LABEL_KEY: Record<(typeof DURATIONS)[number], string> = {
  '1': 'duration_1_month', '3': 'duration_3_months', '6': 'duration_6_months',
};

// The building's floors, bottom to top — the same order the engine's tiers come back in, and the
// only place that order is written down. Everything else (who stands where, who may climb, which
// floor is drawn first) is derived from an index into this.
const TIER_ORDER = Object.keys(MEMBERSHIP_METALS);

const SUB_KEY: Record<string, string> = {
  Free: 'guild_house_sub',
  Silver: 'guild_house_sub_hall',
  Gold: 'guild_house_sub_high',
};

function floorAbove(level: string): string | undefined {
  return TIER_ORDER[TIER_ORDER.indexOf(level) + 1];
}

function floorLabel(level: string): string {
  return i18n.t(`floor_${level}`);
}

export default function MembershipScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { currentLevel, expiresAt, isLoading: membershipLoading, tiers, tiersLoading, upgrade, isUpgrading, upgradeError } = useMembership();

  const standingOn = currentLevel ?? 'Free';
  const standingIndex = TIER_ORDER.indexOf(standingOn);
  const topFloor = standingIndex === TIER_ORDER.length - 1;

  // The floor above the one you stand on, so the button already reads "Climb to The Hall" before
  // any tap — nobody has to pick their own destination the first time they open the house.
  const [selectedTier, setSelectedTier] = useState<string | undefined>(() => floorAbove(standingOn));
  const [selectedDuration, setSelectedDuration] = useState<(typeof DURATIONS)[number]>('1');

  useEffect(() => {
    setSelectedTier(floorAbove(currentLevel ?? 'Free'));
  }, [currentLevel]);

  const [showUpgradeError, setShowUpgradeError] = useState(false);
  useEffect(() => {
    if (upgradeError) setShowUpgradeError(true);
  }, [upgradeError]);

  const byLevel = new Map(tiers.map((t) => [t.level, t] as const));
  // Drawn top to bottom: the High Table first, the Yard last — the reverse of TIER_ORDER, and of
  // how the engine lists them.
  const floors = [...TIER_ORDER].reverse()
    .map((level) => byLevel.get(level))
    .filter((t): t is MembershipTier => !!t);

  // What tapping the button will actually charge — the total for the selected floor at the
  // selected duration, not the flat monthly rate each floor row shows. Silent below one month:
  // there is nothing to total when the duration and the monthly price already say the same thing.
  const selectedPriceOption = selectedTier && Number(selectedDuration) > 1
    ? byLevel.get(selectedTier)?.prices.find((p) => p.durationMonths === Number(selectedDuration))
    : undefined;

  return (
    <View style={styles.container}>
      <HeaderBar title={i18n.t('guild_house')} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tail }]}>
        <Text style={styles.subtitle}>{i18n.t(SUB_KEY[standingOn] ?? 'guild_house_sub')}</Text>
        {currentLevel && currentLevel !== 'Free' && expiresAt && (
          <Text style={styles.expiryLine}>
            {i18n.t('membership_active_until', { date: formatDate(expiresAt) })}
          </Text>
        )}
        {tiersLoading && <Waiting />}
        <AppCard hero style={styles.houseCard}>
          {floors.map((t, i) => {
            const floorIndex = TIER_ORDER.indexOf(t.level);
            const isCurrent = floorIndex === standingIndex;
            const isAbove = floorIndex > standingIndex;
            const isSelected = isAbove && selectedTier === t.level;
            const metal = MEMBERSHIP_METALS[t.level as keyof typeof MEMBERSHIP_METALS] ?? MEMBERSHIP_METALS.Free;
            const floorName = floorLabel(t.level);
            const priceLine = t.monthlyPriceMnt === null
              ? null
              : i18n.t('price_a_month', { price: t.monthlyPriceMnt.toLocaleString() });
            // The tier's daily budget, then whatever it actually unlocks — feature keys arrive
            // from the engine's tier table, so one can land before its translation does; the
            // fallback degrades to the readable key rather than i18n-js's missing marker.
            const perksLine = [
              i18n.t('perk_summons_night', { count: t.dailyMatches }),
              ...t.featureKeys.map((key) => i18n.t(`perk_${key}`, { defaultValue: key.replace(/_/g, ' ') })),
            ].join(' ');
            const ink = isCurrent || isAbove ? styles.floorLit : styles.floorDim;

            const floor = (
              <View style={[
                styles.floorRow,
                i > 0 && styles.floorHairline,
                isSelected && { borderLeftColor: metal.color },
              ]}>
                {isCurrent && <CardEyebrow color={metal.color}>{i18n.t('you_are_here')}</CardEyebrow>}
                <Text style={[styles.floorName, ink]}>{floorName}</Text>
                {priceLine && <Text style={[styles.floorPrice, ink]}>{priceLine}</Text>}
                <Text style={[styles.floorPerks, ink]}>{perksLine}</Text>
              </View>
            );

            if (!isAbove) return <View key={t.level}>{floor}</View>;
            return (
              <Tap
                key={t.level}
                onPress={() => setSelectedTier(t.level)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={[floorName, priceLine, perksLine].filter(Boolean).join('. ')}
              >
                {floor}
              </Tap>
            );
          })}
        </AppCard>
        {!topFloor && (
          <>
            <ChoiceRow
              label={i18n.t('billing_cycle')}
              value={selectedDuration}
              options={DURATIONS}
              optionLabel={(opt) => i18n.t(DURATION_LABEL_KEY[opt])}
              onChange={setSelectedDuration}
            />
            <Text style={styles.terms}>{i18n.t('guild_terms')}</Text>
            {selectedPriceOption && (
              <Text style={styles.priceDetail}>
                {i18n.t('price_total', { amount: selectedPriceOption.totalPriceMnt.toLocaleString() })}
                {selectedPriceOption.discountPct > 0 &&
                  ` · ${i18n.t('save_percent', { percent: selectedPriceOption.discountPct })}`}
              </Text>
            )}
            <View style={styles.buttonWrap}>
              <GameButton
                variant="primary"
                onPress={() => selectedTier && upgrade(selectedTier, Number(selectedDuration))}
                disabled={membershipLoading}
                loading={isUpgrading}
                accessibilityLabel={selectedTier ? i18n.t('climb_to', { floor: floorLabel(selectedTier) }) : undefined}
              >
                {i18n.t('climb')}
              </GameButton>
            </View>
          </>
        )}
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
    color: INK.dim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    marginBottom: SPACE.xs,
  },
  expiryLine: {
    color: ACCENT.base,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.bodyMedium,
    marginBottom: SPACE.xs,
  },
  houseCard: {
    padding: SPACE.xl,
  },
  floorRow: {
    paddingVertical: SPACE.lg,
    paddingLeft: SPACE.md,
    gap: SPACE.xs,
    // Transparent at rest so a selected row's tinted border doesn't shove the text over.
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  floorHairline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE.hairline,
  },
  floorName: {
    fontSize: FONT_SIZES.xl,
    fontFamily: FONTS.display,
  },
  floorPrice: {
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.bodyMedium,
  },
  floorPerks: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.body,
  },
  floorLit: { color: INK.primary },
  floorDim: { color: INK.dim },
  terms: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.sm,
    color: INK.dim,
  },
  priceDetail: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.xs,
    color: INK.dim,
    letterSpacing: TRACKING.wide,
    marginTop: SPACE.xs,
  },
  buttonWrap: {
    marginTop: SPACE.sm,
  },
});
