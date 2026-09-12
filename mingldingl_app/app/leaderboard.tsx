import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { GameHeader } from '../components/ui/GameHeader';
import { GameButton } from '../components/ui/GameButton';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { Entering } from '../components/ui/Entering';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, INK, RADIUS, SPACE, SURFACE, TRACKING } from '../lib/theme';
import { EmptyHint, StateBlock } from '../components/ui/StateBlock';
import type { GemTier } from '../models/user';
import { useScrollTail } from '../hooks/useScrollTail';

const TOP_SLICE_SIZE = 50;

export default function LeaderboardScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data, isLoading, error, isRefetching, refetch } = useLeaderboard();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {/* The city name isn't known until the leaderboard loads, so the loading header renders
            with it blank rather than reading into `data`, which TanStack narrows to `undefined`
            here anyway. */}
        <GameHeader title={i18n.t('leaderboard_title', { city: '' })} icon="podium-gold" showBack />
        <View style={styles.list}>
          <SkeletonRows count={8} gap={SPACE.sm} row={() => (
            <View style={styles.rowShape}>
              <Skeleton width={40} height={FONT_SIZES.lg} />
              <Skeleton width={28} height={28} radius={RADIUS.pill} />
              <Skeleton width="45%" height={FONT_SIZES.md} />
            </View>
          )} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('leaderboard_load_error')}>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
      </StateBlock>
    );
  }

  const entries = data.entries ?? [];
  const ownRowDetached = data.myRank != null && data.myRank > TOP_SLICE_SIZE;

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('leaderboard_title', { city: data.city ?? '' })} icon="podium-gold" showBack />
      <FlatList
        contentContainerStyle={[entries.length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
        data={entries}
        keyExtractor={(item, i) => `${item.rank ?? i}`}
        ListEmptyComponent={<EmptyHint>{i18n.t('leaderboard_empty')}</EmptyHint>}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ACCENT.base} colors={[ACCENT.base]} />
        }
        renderItem={({ item, index }) => {
          const showGap = ownRowDetached && item.isCurrentUser && index > 0;
          return (
            <>
              {showGap && <Text style={styles.gap}>···</Text>}
              {/* The board is anonymous by design — no names come back from the engine — so the
                  score is the only thing that distinguishes one rank from the next. Without it
                  every row rendered identically. */}
              <Entering index={index}>
                <View style={[styles.row, item.isCurrentUser && styles.rowSelf]}>
                  <Text style={[styles.rank, item.isCurrentUser && styles.rankSelf]}>#{item.rank}</Text>
                  <GemTierBadge tier={(item.gemTier as GemTier) ?? 'Garnet'} size={BADGE_SIZES.row} />
                  <Text style={[styles.score, item.isCurrentUser && styles.scoreSelf]}>
                    {(item.score ?? 0).toLocaleString()} {i18n.t('pts')}
                  </Text>
                  {item.isCurrentUser && <Text style={styles.youTag}>{i18n.t('leaderboard_you')}</Text>}
                </View>
              </Entering>
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.lg },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  gap: { color: INK.dim, textAlign: 'center', fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, marginVertical: SPACE.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.sm,
  },
  rowSelf: {
    backgroundColor: SURFACE.raised,
    borderWidth: 1,
    borderColor: ACCENT.base,
  },
  rank: { width: 40, fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.dim },
  rankSelf: { color: ACCENT.base },
  rowShape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  score: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.primary, flexShrink: 1 },
  scoreSelf: { fontFamily: FONTS.bodyBold, color: ACCENT.bright },
  youTag: {
    marginLeft: 'auto',
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: TRACKING.wide,
    color: ACCENT.base,
  },
});
