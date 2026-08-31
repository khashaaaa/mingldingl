import { View, Text, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
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
import { TiledBackdrop } from '../components/ui/TiledBackdrop';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS } from '../lib/theme';
import type { GemTier } from '../models/user';
import { Icon } from '../components/ui/Icon';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

export default function ProgressionScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: detail, isLoading, error, refetch } = useScoreDetail();
  const { data: historyItems, fetchNextPage, hasNextPage, isFetchingNextPage } = useScoreHistory();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Spinner color="$gold" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centered}>
        <Icon name="trending-down" size={32} color={COLORS.bronze} />
        <Text style={styles.errorTitle}>{i18n.t('progression_load_error')}</Text>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
      </View>
    );
  }

  const gemTier = (detail.gemTier as GemTier) ?? 'Garnet';
  const nextTier = detail.nextTier as GemTier | null;

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <GameHeader title={i18n.t('progression_title')} icon="chart-line" showBack />
      <View style={styles.headerRow}>
        <GemTierBadge tier={gemTier} size={44} glow />
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
        <GameButton variant="ghost" icon="podium-gold" onPress={() => router.push('/leaderboard')}>
          {i18n.t('view_leaderboard')}
        </GameButton>
      </View>
      <Text style={styles.historyTitle}>{i18n.t('progression_history_title')}</Text>
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
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emoji: { fontSize: 48 },
  errorTitle: { color: COLORS.text, fontSize: 18, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  xpBarWrap: { flex: 1 },
  leaderboardButtonWrap: { marginHorizontal: 20, marginBottom: 4 },
  historyTitle: { color: COLORS.textDim, fontFamily: FONTS.display, fontSize: 12, letterSpacing: 2, marginHorizontal: 20, marginBottom: 8 },
});
