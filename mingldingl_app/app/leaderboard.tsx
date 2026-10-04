import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { HeaderBar } from '../components/ui/HeaderBar';
import { GameButton } from '../components/ui/GameButton';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { TorchGlow } from '../components/vfx/TorchGlow';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { Entering } from '../components/ui/Entering';
import { i18n, lineLocale, normalizeLocale } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { rankNumeral } from '../lib/numerals';
import { tierLabel, cityKey, cityLabel } from '../lib/tiers';
import {
  BADGE_SIZES, FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, TEMPERATURE, TRACKING, tint,
} from '../lib/theme';
import { EmptyHint, StateBlock } from '../components/ui/StateBlock';
import type { GemTier } from '../models/user';
import { useScrollTail } from '../hooks/useScrollTail';
import { goBack } from '../lib/navigation';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { ScreenLede } from '../components/ui/ScreenLede';

const TOP_SLICE_SIZE = 50;

/** Roughly the drawn height of one row, for the torch's glow canvas — see `QuestTile.tsx`'s own
 *  `ROW_HEIGHT`, not load-bearing precision. */
const ROW_HEIGHT = 56;

export default function LeaderboardScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data, isLoading, error, refetch } = useLeaderboard();
  const emptyHall = (data?.entries ?? []).length === 0;
  const listStyle = useMemo(
    () => [emptyHall ? styles.listEmpty : styles.list, { paddingBottom: tail }],
    [emptyHall, tail],
  );
  useRefreshOnFocus(refetch);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <HeaderBar title={i18n.t('hall_of_names')} />
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
        <GameButton variant="ink" onPress={() => goBack(router)}>{i18n.t('back')}</GameButton>
      </StateBlock>
    );
  }

  const entries = data.entries ?? [];
  const ownRowDetached = data.myRank != null && data.myRank > TOP_SLICE_SIZE;

  // The engine hands a city or nothing; `hall_sub` reads "%{city}. Carved, not listed…", so a
  // missing city takes its own sentence rather than a regex trimming the translated one.
  const city = data.city ?? '';
  const said = lineLocale('hall_sub', ...(cityKey(city) ? [cityKey(city)!] : []));
  const hallSub = city
    ? i18n.t('hall_sub', { city: cityLabel(city, said), locale: said })
    : i18n.t('hall_sub_no_city');

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('hall_of_names')} />
      <ScreenLede style={styles.sub}>{hallSub}</ScreenLede>
      <FlatList
        contentContainerStyle={listStyle}
        data={entries}
        keyExtractor={(item, i) => `${item.rank ?? i}`}
        ListEmptyComponent={<View style={styles.emptyWrap}><EmptyHint>{i18n.t('leaderboard_empty')}</EmptyHint></View>}
        ListFooterComponent={
          <>
            {/* The pairs who stopped needing the hall. A count only, like every row above it. */}
            {(data.hearthboundPairs ?? 0) > 0 && (
              <Text style={styles.law}>{i18n.t('hall_hearthbound', { count: data.hearthboundPairs ?? 0 })}</Text>
            )}
            <Text style={styles.law}>{i18n.t('hall_law')}</Text>
          </>
        }
        renderItem={({ item, index }) => {
          const isOwn = !!item.isCurrentUser;
          const showGap = ownRowDetached && isOwn && index > 0;
          // The DTO always carries `rank`; the fallbacks only cover a caller that trims it —
          // the top slice can still count off its own position, and the detached own row (past
          // TOP_SLICE_SIZE) has nothing but `myRank` to fall back on.
          const rank = item.rank ?? (isOwn ? data.myRank : undefined) ?? index + 1;
          // A real rank has no ceiling — `rankNumeral` falls back to Arabic digits past what a
          // Roman numeral can express, rather than throw for the person checking her own standing.
          const numeral = rankNumeral(rank);
          const tierName = tierLabel(item.gemTier ?? 'Garnet');
          const score = item.score ?? 0;
          const mark = isOwn ? ownMark() : null;
          const label = `${numeral}. ${tierName}. ${score} ${i18n.t('pts')}${mark ? `. ${mark}` : ''}`;

          const row = (
            <View style={styles.row} accessible accessibilityLabel={label}>
              <Text style={styles.rank}>{numeral}</Text>
              <View style={styles.tierGroup}>
                <GemTierBadge tier={(item.gemTier as GemTier) ?? 'Garnet'} size={BADGE_SIZES.row} />
                {/* The mark takes the tier name's own slot rather than stacking above the score:
                    stacked, it made this one row taller than the rest and dropped its score
                    below the others' line. */}
                {isOwn ? (
                  <Text style={styles.eyebrow}>{mark ? `${tierName} · ${mark}` : tierName}</Text>
                ) : (
                  <Text style={styles.tierName}>{tierName}</Text>
                )}
              </View>
              <View style={styles.scoreGroup}>
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
                  // `TorchGlow` used to wrap the row and lay it out at size × size, which squeezed
                  // the own row into a 56px column (the eyebrow wrapped letter by letter, the
                  // numeral vanished). The glow now sits behind the row as its own absolute layer,
                  // sized to roughly a row's height, while the row itself lays out full width
                  // exactly like every other row.
                  <View>
                    <View style={styles.ownGlow} pointerEvents="none" accessible={false} importantForAccessibility="no">
                      <TorchGlow size={ROW_HEIGHT} color={TEMPERATURE.furnaceBright} strength={0.8}>
                        <View style={{ width: ROW_HEIGHT, height: ROW_HEIGHT }} />
                      </TorchGlow>
                    </View>
                    {row}
                  </View>
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
  // Behind the row, not around it — a layer, not a wrapper that lays the row's own children out.
  ownGlow: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  sub: { paddingHorizontal: SPACE.gutter, marginBottom: SPACE.sm },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, paddingHorizontal: SPACE.gutter },
  emptyWrap: { flex: 1, justifyContent: 'center' },
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

/** "Your mark", or nothing while it has no word in this language: the gem names down the column
 *  are translated, so an English mark beside one read "ИНДРАНИЛ · YOUR MARK", and switching the
 *  row's gem to English put "SAPPHIRE" among the Индранилs. The row's own glow still marks it. */
function ownMark(): string | null {
  return lineLocale('your_mark') === normalizeLocale(i18n.locale) ? i18n.t('your_mark') : null;
}
