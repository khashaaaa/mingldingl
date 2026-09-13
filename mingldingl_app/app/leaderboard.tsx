import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { GameHeader } from '../components/ui/GameHeader';
import { GameButton } from '../components/ui/GameButton';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { TorchGlow } from '../components/vfx/TorchGlow';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { Entering } from '../components/ui/Entering';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { romanNumeral } from '../lib/numerals';
import { tierLabel } from '../lib/tiers';
import {
  ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, TEMPERATURE, TRACKING, tint,
} from '../lib/theme';
import { EmptyHint, StateBlock } from '../components/ui/StateBlock';
import type { GemTier } from '../models/user';
import { useScrollTail } from '../hooks/useScrollTail';

const TOP_SLICE_SIZE = 50;

/** Roughly the drawn height of one row, for the torch's glow canvas — see `QuestTile.tsx`'s own
 *  `ROW_HEIGHT`, not load-bearing precision. */
const ROW_HEIGHT = 56;

export default function LeaderboardScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data, isLoading, error, isRefetching, refetch } = useLeaderboard();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <GameHeader title={i18n.t('hall_of_names')} icon="podium-gold" showBack />
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

  // The engine hands a city or nothing; `hall_sub` reads "%{city}. Carved, not listed…" and an
  // empty city would otherwise leave a bare ". " stuck on the front of the sentence.
  const city = data.city ?? '';
  const hallSub = city
    ? i18n.t('hall_sub', { city })
    : i18n.t('hall_sub', { city: '' }).replace(/^\.\s*/, '');

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('hall_of_names')} icon="podium-gold" showBack />
      <Text style={styles.sub}>{hallSub}</Text>
      <FlatList
        contentContainerStyle={[entries.length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
        data={entries}
        keyExtractor={(item, i) => `${item.rank ?? i}`}
        ListEmptyComponent={<EmptyHint>{i18n.t('leaderboard_empty')}</EmptyHint>}
        ListFooterComponent={<Text style={styles.law}>{i18n.t('hall_law')}</Text>}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ACCENT.base} colors={[ACCENT.base]} />
        }
        renderItem={({ item, index }) => {
          const isOwn = !!item.isCurrentUser;
          const showGap = ownRowDetached && isOwn && index > 0;
          // The DTO always carries `rank`; the fallbacks only cover a caller that trims it —
          // the top slice can still count off its own position, and the detached own row (past
          // TOP_SLICE_SIZE) has nothing but `myRank` to fall back on.
          const rank = item.rank ?? (isOwn ? data.myRank : undefined) ?? index + 1;
          const numeral = romanNumeral(rank);
          const tierName = tierLabel(item.gemTier ?? 'Garnet');
          const score = item.score ?? 0;
          const label = `${numeral}. ${tierName}. ${score} points${isOwn ? `. ${i18n.t('your_mark')}` : ''}`;

          const row = (
            <View style={styles.row} accessible accessibilityLabel={label}>
              <Text style={styles.rank}>{numeral}</Text>
              <View style={styles.tierGroup}>
                <GemTierBadge tier={(item.gemTier as GemTier) ?? 'Garnet'} size={BADGE_SIZES.row} />
                <Text style={styles.tierName}>{tierName}</Text>
              </View>
              <View style={styles.scoreGroup}>
                {isOwn && (
                  <Text style={styles.eyebrow}>{`${tierName} · ${i18n.t('your_mark')}`}</Text>
                )}
                <Text style={styles.score}>{score.toLocaleString()}</Text>
              </View>
            </View>
          );

          return (
            <>
              {showGap && <Text style={styles.gap}>···</Text>}
              {/* The board is anonymous by design — no names come back from the engine — so rank,
                  gem and score are the only things that tell one row from the next. */}
              <Entering index={index}>
                {isOwn ? (
                  <TorchGlow size={ROW_HEIGHT} color={TEMPERATURE.furnaceBright} strength={0.8}>
                    {row}
                  </TorchGlow>
                ) : row}
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
  sub: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    paddingHorizontal: SPACE.gutter,
    marginBottom: SPACE.sm,
  },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  gap: { color: INK.dim, textAlign: 'center', fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, marginVertical: SPACE.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    // The stone the wall is built from, at the opacity the brief calls for — a hairline below
    // each row is the mortar, not a card border.
    backgroundColor: tint(SURFACE.raised, 0.4),
    borderBottomWidth: 1,
    borderBottomColor: LINE.hairline,
  },
  rank: { width: 40, fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.dim },
  rowShape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  tierGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  tierName: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.xs,
    color: INK.dim,
    letterSpacing: TRACKING.wide,
    textTransform: 'uppercase',
  },
  scoreGroup: { marginLeft: 'auto', alignItems: 'flex-end' },
  score: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.primary, textAlign: 'right' },
  // The eyebrow is the only place this screen may reach for the furnace tokens outside the torch
  // itself — see `lib/__tests__/furnace.test.ts`'s allowlist.
  eyebrow: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.xs,
    color: TEMPERATURE.furnace,
    letterSpacing: TRACKING.wide,
    textTransform: 'uppercase',
    marginBottom: SPACE.hair,
  },
  law: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    textAlign: 'center',
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.gutter,
  },
});
