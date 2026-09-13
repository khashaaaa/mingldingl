import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useScoreDetail } from '../hooks/useScoreDetail';
import { useScoreHistory } from '../hooks/useScoreHistory';
import { useProfile } from '../hooks/useProfile';
import { GameHeader } from '../components/ui/GameHeader';
import { AppCard } from '../components/ui/AppCard';
import { AscentSky } from '../components/progression/AscentSky';
import { TierPerkCard } from '../components/progression/TierPerkCard';
import { ScoreHistoryList } from '../components/progression/ScoreHistoryList';
import { GameButton } from '../components/ui/GameButton';
import { Skeleton } from '../components/ui/Skeleton';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { FONTS, FONT_SIZES, INK, RADIUS, SPACE } from '../lib/theme';
import { StateBlock } from '../components/ui/StateBlock';
import type { GemTier } from '../models/user';
import { CardEyebrow } from '../components/ui/CardEyebrow';

/** Assumed width until `onLayout` reports the real one — see `GateScene`'s own note on the pattern. */
const FALLBACK_SKY_WIDTH = 320;

export default function ProgressionScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: detail, isLoading, error, refetch } = useScoreDetail();
  const { data: historyItems, fetchNextPage, hasNextPage, isFetchingNextPage } = useScoreHistory();
  const { data: profile } = useProfile();
  const [skyWidth, setSkyWidth] = useState(FALLBACK_SKY_WIDTH);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <GameHeader title={i18n.t('progression_title')} icon="chart-line" showBack />
        <View style={styles.loadingBody}>
          <Skeleton width="100%" height={14} radius={RADIUS.sm} />
          <Skeleton width="60%" height={FONT_SIZES.title} />
          <Skeleton width="100%" height={120} />
        </View>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <StateBlock tone="danger" icon="trending-down" title={i18n.t('progression_load_error')}>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
      </StateBlock>
    );
  }

  const gemTier = (detail.gemTier as GemTier) ?? 'Garnet';
  const nextTier = detail.nextTier as GemTier | null;

  function onSkyLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== skyWidth) setSkyWidth(w);
  }

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('progression_title')} icon="chart-line" showBack />
      <Text style={styles.sub}>{i18n.t('ascent_sub')}</Text>
      <AppCard hero style={styles.skyCard}>
        <View onLayout={onSkyLayout}>
          <AscentSky
            gemTier={gemTier}
            totalScore={detail.totalScore ?? 0}
            currentStreak={detail.currentStreak ?? 0}
            longestStreak={detail.longestStreak ?? 0}
            width={skyWidth}
          />
        </View>
      </AppCard>
      <TierPerkCard gemTier={gemTier} tierBonus={detail.tierBonus ?? 0} nextTier={nextTier} dailyMatchBudget={detail.dailyMatchBudget} />
      <View style={styles.leaderboardButtonWrap}>
        <GameButton variant="ink" icon="podium-gold" onPress={() => router.push('/leaderboard')}>
          {i18n.t('hall_of_names')}
        </GameButton>
      </View>
      <CardEyebrow style={styles.historyTitle}>{i18n.t('progression_history_title')}</CardEyebrow>
      <ScoreHistoryList
        items={(historyItems ?? []).filter(
          (item): item is { eventType: string; delta: number; createdAt: string } =>
            item.eventType != null && item.delta != null && item.createdAt != null
        )}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        isFetchingNextPage={isFetchingNextPage}
        joinedAt={profile?.joinedAt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.lg },
  loadingBody: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.giant, gap: SPACE.lg },
  sub: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    paddingHorizontal: SPACE.gutter,
    marginBottom: SPACE.sm,
  },
  skyCard: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, overflow: 'hidden' },
  leaderboardButtonWrap: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.xs },
  historyTitle: { marginHorizontal: SPACE.gutter },
});
