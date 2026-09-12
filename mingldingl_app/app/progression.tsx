import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useScoreDetail } from '../hooks/useScoreDetail';
import { useScoreHistory } from '../hooks/useScoreHistory';
import { GameHeader } from '../components/ui/GameHeader';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { XPBar } from '../components/progression/XPBar';
import { TierPerkCard } from '../components/progression/TierPerkCard';
import { StreakSummary } from '../components/progression/StreakSummary';
import { ScoreHistoryList } from '../components/progression/ScoreHistoryList';
import { GameButton } from '../components/ui/GameButton';
import { Skeleton } from '../components/ui/Skeleton';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { BADGE_SIZES, FONT_SIZES, RADIUS, SPACE } from '../lib/theme';
import { StateBlock } from '../components/ui/StateBlock';
import type { GemTier } from '../models/user';
import { CardEyebrow } from '../components/ui/CardEyebrow';

export default function ProgressionScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: detail, isLoading, error, refetch } = useScoreDetail();
  const { data: historyItems, fetchNextPage, hasNextPage, isFetchingNextPage } = useScoreHistory();

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

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('progression_title')} icon="chart-line" showBack />
      <View style={styles.headerRow}>
        <GemTierBadge tier={gemTier} size={BADGE_SIZES.hero} glow />
        <View style={styles.xpBarWrap}>
          <XPBar
            gemTier={gemTier}
            totalScore={detail.totalScore ?? 0}
            pct={(detail.progressPct ?? 0) / 100}
            nextTier={nextTier}
            nextTierThreshold={detail.nextTierThreshold}
          />
        </View>
      </View>
      <TierPerkCard gemTier={gemTier} tierBonus={detail.tierBonus ?? 0} nextTier={nextTier} dailyMatchBudget={detail.dailyMatchBudget} />
      <StreakSummary currentStreak={detail.currentStreak ?? 0} longestStreak={detail.longestStreak ?? 0} />
      <View style={styles.leaderboardButtonWrap}>
        <GameButton variant="ink" icon="podium-gold" onPress={() => router.push('/leaderboard')}>
          {i18n.t('view_leaderboard')}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.lg },
  loadingBody: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.giant, gap: SPACE.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  xpBarWrap: { flex: 1 },
  leaderboardButtonWrap: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.xs },
  historyTitle: { marginHorizontal: SPACE.gutter },
});
