import { Text, View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Tap } from '../../components/ui/Tap';
import { useActivity } from '../../hooks/useActivity';
import type { Business } from '../../models/business';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { QuestBoard } from '../../components/quest/QuestBoard';
import { FatedThreadsSection } from '../../components/quest/FatedThreadsSection';
import { Skeleton, SkeletonRows } from '../../components/ui/Skeleton';
import { Entering } from '../../components/ui/Entering';
import { Waiting } from '../../components/ui/Waiting';
import { i18n } from '../../lib/i18n';
import { Icon } from '../../components/ui/Icon';
import { useLocaleStore } from '../../store/localeStore';
import { LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, SURFACE, TRACKING } from '../../lib/theme';
import { EmptyHint, StateBlock } from '../../components/ui/StateBlock';
type CategoryGlyph = React.ComponentProps<typeof Icon>['name'];

// Must stay in step with mingldingl_control's BusinessForm CATEGORIES — the venues the engine
// actually holds are these six; the old list (Cinema/Hiking/BoardGameCafe) matched nothing, so
// every restaurant, bar and outdoor venue fell through to the generic pin.
const CATEGORY_ICONS: Record<string, CategoryGlyph> = {
  Cafe: 'coffee',
  Restaurant: 'silverware-fork-knife',
  Bar: 'glass-cocktail',
  Entertainment: 'movie-open',
  Outdoor: 'hiking',
  Culture: 'bank',
};

function missionIcon(category: string): CategoryGlyph {
  return CATEGORY_ICONS[category] ?? 'map-marker-star';
}

function missionPoints(b: Business): number {
  if (b.isFeatured) return 50;
  if (b.isVerified) return 30;
  if (b.averageRating >= 4) return 25;
  return 15;
}

export default function ActivityScreen() {
  useLocaleStore((s) => s.locale);
  const { data: businesses, isLoading, isError, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('mission_board')} icon="anvil" />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ACCENT.base} colors={[ACCENT.base]} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
          if (nearBottom && hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        scrollEventThrottle={200}
      >
        <GameButton
          variant="ink"
          icon="bow-arrow"
          onPress={() => router.push('/ship/new')}
          style={styles.weaveButton}
        >
          {i18n.t('weave_new_thread_cta')}
        </GameButton>
        <FatedThreadsSection />
        <QuestBoard />
        {isLoading ? (
          <SkeletonRows count={4} gap={SPACE.lg} row={() => (
            <Skeleton width="100%" height={110} radius={RADIUS.md} />
          )} />
        ) : isError ? (
          <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
            <GameButton size="compact" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </StateBlock>
        ) : !businesses || businesses.length === 0 ? (
          <EmptyHint>{i18n.t('no_missions')}</EmptyHint>
        ) : (
          businesses.map((b, index) => (
            <Entering index={index} key={b.id}>
              <Tap
               
                onPress={() => router.push({
                  pathname: `/business/${b.id}` as any,
                  params: {
                    name: b.name,
                    description: b.description,
                    category: b.category,
                    district: b.district,
                    photo: b.photoUrls[0] ?? '',
                    averageRating: String(b.averageRating),
                    ratingCount: String(b.ratingCount),
                    operatingHours: b.operatingHours,
                  },
                })}
              >
                <AppCard style={styles.missionCard}>
                  <View style={styles.row}>
                    <View style={styles.iconWrap}>
                      <Icon name={missionIcon(b.category)} size={ICON_SIZES.xl} color={ACCENT.base} style={styles.missionIcon} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.missionTitle} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.missionDesc} numberOfLines={2}>{b.description}</Text>
                      <Text style={styles.meta}>{b.category} · {b.district}</Text>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsValue}>+{missionPoints(b)}</Text>
                      <Text style={styles.pointsLabel}>{i18n.t('pts')}</Text>
                    </View>
                  </View>
                </AppCard>
              </Tap>
            </Entering>
          ))
        )}
        {isFetchingNextPage && (
          <View style={styles.center}>
            <Waiting size={ICON_SIZES.md} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.giant, gap: SPACE.sm },
  retryButton: { marginTop: SPACE.sm },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail, flexGrow: 1 },
  weaveButton: { marginBottom: SPACE.lg },
  missionCard: { marginBottom: SPACE.lg, padding: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: SURFACE.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionIcon: { width: 26, textAlign: 'center' },
  info: { flex: 1 },
  missionTitle: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: INK.primary, marginBottom: SPACE.xs },
  missionDesc: { fontSize: FONT_SIZES.sm, color: INK.dim, lineHeight: LEADING.sm, marginBottom: SPACE.xs, fontFamily: FONTS.body },
  meta: { fontSize: FONT_SIZES.sm, color: INK.dim, fontFamily: FONTS.body },
  pointsBadge: {
    backgroundColor: ACCENT.soft,
    borderWidth: 1,
    borderColor: ACCENT.base,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    alignItems: 'center',
    minWidth: 52,
  },
  pointsValue: { color: ACCENT.base, fontSize: FONT_SIZES.lg, fontFamily: FONTS.display },
  pointsLabel: { color: ACCENT.base, fontSize: FONT_SIZES.xs, fontFamily: FONTS.bodyMedium, letterSpacing: TRACKING.label },
});
