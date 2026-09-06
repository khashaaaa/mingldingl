import {
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useActivity } from '../../hooks/useActivity';
import type { Business } from '../../models/business';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { QuestBoard } from '../../components/quest/QuestBoard';
import { FatedThreadsSection } from '../../components/quest/FatedThreadsSection';
import { i18n } from '../../lib/i18n';
import { Icon } from '../../components/ui/Icon';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FILL, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';


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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.gold} colors={[COLORS.gold]} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
          if (nearBottom && hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        scrollEventThrottle={200}
      >
        <GameButton
          variant="ghost"
          icon="bow-arrow"
          onPress={() => router.push('/ship/new')}
          style={styles.weaveButton}
        >
          {i18n.t('weave_new_thread_cta')}
        </GameButton>
        <FatedThreadsSection />
        <QuestBoard />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Icon name="alert-circle-outline" size={ICON_SIZES.huge} color={INK.muted} />
            <Text style={styles.emptyText}>{i18n.t('screen_load_error')}</Text>
            <GameButton size="compact" onPress={() => refetch()} style={styles.retryButton}>
              {i18n.t('retry')}
            </GameButton>
          </View>
        ) : !businesses || businesses.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{i18n.t('no_missions')}</Text>
          </View>
        ) : (
          businesses.map((b) => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.8}
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
                    <Icon name={missionIcon(b.category)} size={ICON_SIZES.xl} color={COLORS.gold} style={styles.missionIcon} />
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
            </TouchableOpacity>
          ))
        )}
        {isFetchingNextPage && (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={COLORS.gold} />
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
  emptyText: { color: COLORS.textDim, fontSize: FONT_SIZES.lg, fontFamily: FONTS.body },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail, flexGrow: 1 },
  weaveButton: { marginBottom: SPACE.lg },
  missionCard: { marginBottom: SPACE.lg, padding: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionIcon: { width: 26, textAlign: 'center' },
  info: { flex: 1 },
  missionTitle: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: COLORS.text, marginBottom: SPACE.xs },
  missionDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textDim, lineHeight: LINE_HEIGHTS.sm, marginBottom: SPACE.xs, fontFamily: FONTS.body },
  meta: { fontSize: FONT_SIZES.sm, color: COLORS.textDim, fontFamily: FONTS.body },
  pointsBadge: {
    backgroundColor: FILL.gold,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    alignItems: 'center',
    minWidth: 52,
  },
  pointsValue: { color: COLORS.gold, fontSize: FONT_SIZES.lg, fontFamily: FONTS.display },
  pointsLabel: { color: COLORS.gold, fontSize: FONT_SIZES.xs, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
});
