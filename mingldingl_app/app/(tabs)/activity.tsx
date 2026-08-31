import {
  Text,
  View,
  ScrollView,
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
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { Icon } from '../../components/ui/Icon';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const PARCHMENT_ASSET = require('../../assets/textures/parchment.png');

type CategoryGlyph = React.ComponentProps<typeof Icon>['name'];

const CATEGORY_ICONS: Record<string, CategoryGlyph> = {
  Cafe: 'coffee',
  Cinema: 'movie-open',
  Hiking: 'hiking',
  BoardGameCafe: 'dice-multiple',
  Other: 'map-marker-star',
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
  const { data: businesses, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={PARCHMENT_ASSET} opacity={0.2} />
      <GameHeader title={i18n.t('mission_board')} icon="anvil" />
      <ScrollView
        contentContainerStyle={styles.list}
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
            <Icon name="alert-circle-outline" size={32} color={COLORS.bronze} />
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
                    <Icon name={missionIcon(b.category)} size={24} color={COLORS.gold} style={styles.missionIcon} />
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
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  retryButton: { marginTop: 8 },
  emptyText: { color: COLORS.textDim, fontSize: 16, fontFamily: FONTS.body },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  weaveButton: { marginBottom: 16 },
  missionCard: { marginBottom: 14, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  missionTitle: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.text, marginBottom: 3 },
  missionDesc: { fontSize: 12, color: COLORS.textDim, lineHeight: 17, marginBottom: 4, fontFamily: FONTS.body },
  meta: { fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.body },
  pointsBadge: {
    backgroundColor: 'rgba(217,127,31,0.15)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 52,
  },
  pointsValue: { color: COLORS.gold, fontSize: 16, fontFamily: FONTS.display },
  pointsLabel: { color: COLORS.gold, fontSize: 9, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
});
