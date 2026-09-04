import { View, Text as RNText, StyleSheet, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import { useDiscover, useRequestMatch } from '../../hooks/useDiscover';
import { useProfile } from '../../hooks/useProfile';
import { useMilestones } from '../../hooks/useMilestones';
import { useDailyMatchBudget } from '../../hooks/useScore';
import { DailyBudgetMeter } from '../../components/progression/DailyBudgetMeter';
import { CandidateCard } from '../../components/cards/CandidateCard';
import { GettingStartedCard } from '../../components/progression/GettingStartedCard';
import { LootToast } from '../../components/modals/LootToast';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { PanelReveal } from '../../components/modals/PanelReveal';
import { EmberField } from '../../components/vfx/EmberField';
import { FogDrift } from '../../components/vfx/FogDrift';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function DiscoverScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const [toast, setToast] = useState(false);
  const [toastPoints, setToastPoints] = useState(0);
  const [failAlert, setFailAlert] = useState<'generic' | 'dailyBudget' | 'unavailable' | null>(null);
  const { candidates, isLoading, isError, refetch, markSeen } = useDiscover();
  const { mutate: requestMatch, isPending: isRequesting } = useRequestMatch();
  const { data: profile } = useProfile();
  const { milestones } = useMilestones();
  const dailyBudget = useDailyMatchBudget();
  const budgetSpent = dailyBudget !== null && dailyBudget.remaining <= 0;
  const [deckSize, setDeckSize] = useState({ w: 0, h: 0 });
  const [emptySize, setEmptySize] = useState({ w: 0, h: 0 });

  function onDeckLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setDeckSize({ w: width, h: height });
  }

  function onEmptyLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setEmptySize({ w: width, h: height });
  }

  if (isLoading) return (
    <View style={styles.center}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ActivityIndicator color={COLORS.gold} size="large" />
    </View>
  );

  if (isError) return (
    <View style={styles.center}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <View style={styles.emptyCard}>
        <Icon name="wifi-off" size={ICON_SIZES.hero} color={COLORS.bronze} />
        <RNText style={styles.emptyTitle}>{i18n.t('discover_load_error')}</RNText>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
      </View>
    </View>
  );

  const candidate = candidates?.[0];

  if (!candidate) return (
    <View style={styles.center}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <View style={styles.emptyCard} onLayout={onEmptyLayout}>
        {emptySize.w > 0 && <FogDrift width={emptySize.w} height={emptySize.h} />}
        <Icon name="weather-night" size={ICON_SIZES.hero} color={COLORS.bronze} />
        <RNText style={styles.emptyTitle}>{i18n.t('empty_seek_title')}</RNText>
        <RNText style={styles.emptySub}>{i18n.t('empty_seek_sub')}</RNText>
        <GameButton variant="ghost" size="compact" icon="refresh" onPress={() => refetch()}>
          {i18n.t('refresh')}
        </GameButton>
      </View>
    </View>
  );

  const achievedMilestoneIds = milestones.filter((m) => m.achievedAt).map((m) => m.id ?? '');

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <GameHeader title={i18n.t('seek_title')} icon="sword-cross" showScore />
      <GettingStartedCard
        isProfileComplete={profile?.isProfileComplete ?? false}
        achievedMilestoneIds={achievedMilestoneIds}
        onCompleteProfile={() => router.push('/edit-profile')}
      />
      {dailyBudget && <DailyBudgetMeter budget={dailyBudget} />}
      <View style={styles.cardArea} onLayout={onDeckLayout}>
        <PanelReveal style={{ flex: 1 }}>
          <CandidateCard
            candidate={candidate}
            requesting={isRequesting}
            requestDisabled={budgetSpent}
            onRequest={() => requestMatch(candidate, {
              onSuccess: ({ awarded }) => {
                setToastPoints(awarded);
                setToast(true);
              },
              onError: (err) => {
                const status = isAxiosError(err) ? err.response?.status : undefined;
                if (status === 409 || status === 403) {
                  markSeen(candidate.id);
                  setFailAlert('unavailable');
                } else if (status === 400) {
                  setFailAlert('dailyBudget');
                } else {
                  setFailAlert('generic');
                }
              },
            })}
            onSkip={() => markSeen(candidate.id)}
          />
        </PanelReveal>
        {deckSize.w > 0 && <EmberField width={deckSize.w} height={deckSize.h} density={8} />}
      </View>
      <LootToast
        title={i18n.t('match_requested')}
        points={toastPoints}
        visible={toast}
        onDismiss={() => setToast(false)}
        bottomOffset={68}
      />
      <AlertModal
        visible={failAlert !== null}
        tone="warning"
        title={i18n.t(
          failAlert === 'dailyBudget' ? 'daily_budget_title'
            : failAlert === 'unavailable' ? 'candidate_unavailable'
            : 'action_failed_title',
        )}
        message={i18n.t(
          failAlert === 'dailyBudget' ? 'daily_budget_body'
            : failAlert === 'unavailable' ? 'candidate_unavailable_body'
            : 'action_failed_body',
        )}
        onDismiss={() => setFailAlert(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  cardArea: { flex: 1, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.lg },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    padding: SPACE.giant,
    alignItems: 'center',
    gap: SPACE.md,
  },
  emptyTitle: { fontSize: FONT_SIZES.title, fontFamily: FONTS.display, color: COLORS.text },
  emptySub: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
