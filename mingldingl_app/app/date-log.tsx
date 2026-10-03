import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useMyTrophies } from '../hooks/useMyTrophies';
import { GameHeader } from '../components/ui/GameHeader';
import { GameButton } from '../components/ui/GameButton';
import { AppCard } from '../components/ui/AppCard';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { Entering } from '../components/ui/Entering';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, SURFACE } from '../lib/theme';
import { StateBlock } from '../components/ui/StateBlock';
import type { Trophy } from '../models/trophy';
import { Icon } from '../components/ui/Icon';
import { useScrollTail } from '../hooks/useScrollTail';
import { useStanding } from '../hooks/useStanding';

function TrophyRow({ trophy }: { trophy: Trophy }) {
  const photo = trophy.myMomentPhotoUrl ?? trophy.businessPhoto;
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Icon name="map-marker-star" size={ICON_SIZES.xl} color={INK.muted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{trophy.businessName ?? trophy.activityTitle}</Text>
          {/* The activity is often named after the venue it happens at, and printing both then
              showed the same words twice, one above the other. */}
          {trophy.businessName && trophy.activityTitle !== trophy.businessName && (
            <Text style={styles.subtitle} numberOfLines={1}>{trophy.activityTitle}</Text>
          )}
          <Text style={styles.date}>
            {formatDate(trophy.confirmedAt)}
            {trophy.district ? ` · ${trophy.district}` : ''}
          </Text>
          {trophy.kept && trophy.district && (
            <View style={styles.charted}>
              <Icon name="map-marker-check" size={ICON_SIZES.sm} color={ACCENT.base} />
              <Text style={styles.chartedText}>{i18n.t('waypoint_charted')}</Text>
            </View>
          )}
          {trophy.mismatched ? (
            <Text style={styles.unrated}>{i18n.t('date_log_unconfirmed')}</Text>
          ) : trophy.myStars ? (
            <View
              style={styles.starsRow}
              accessible
              accessibilityRole="text"
              accessibilityLabel={i18n.t('stars_of_five', { count: trophy.myStars })}
            >
              {Array.from({ length: trophy.myStars }).map((_, i) => (
                <Icon key={i} name="star" size={ICON_SIZES.sm} color={ACCENT.base} />
              ))}
            </View>
          ) : (
            <Text style={styles.unrated}>{i18n.t('date_log_unrated')}</Text>
          )}
        </View>
      </View>
    </AppCard>
  );
}

export default function DateLogScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { data: trophies, isLoading, isError, refetch } = useMyTrophies();
  const { data: standing } = useStanding();

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('date_log_title')} showBack />
      {isLoading ? (
        <View style={styles.list}>
          <SkeletonRows count={4} gap={SPACE.md} row={() => (
            <View style={styles.skeletonRow}>
              <Skeleton width={64} height={64} radius={RADIUS.md} />
              <View style={styles.skeletonInfo}>
                <Skeleton width="70%" height={FONT_SIZES.lg} />
                <Skeleton width="35%" height={FONT_SIZES.sm} />
              </View>
            </View>
          )} />
        </View>
      ) : isError ? (
        <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
          <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        </StateBlock>
      ) : (
        <FlatList
          contentContainerStyle={[(trophies ?? []).length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
          data={trophies ?? []}
          // One match can hold more than one kept encounter, so the match alone is not a key.
          keyExtractor={(t) => `${t.matchId}:${t.confirmedAt}`}
          ListHeaderComponent={standing && (trophies ?? []).length > 0 ? (
            <View style={styles.waypointsHead}>
              <Icon name="map-legend" size={ICON_SIZES.md} color={ACCENT.base} />
              <Text style={styles.waypointsText}>
                {i18n.t('waypoints_charted', { charted: standing.districtsCharted ?? 0, needed: standing.cartographerNeeded ?? 0 })}
              </Text>
            </View>
          ) : null}
          // A drawn place, like every other empty room — a lone grey line floated in the middle of
          // an otherwise blank screen.
          ListEmptyComponent={<StateBlock icon="book-heart-outline" title={i18n.t('date_log_empty')} />}
          renderItem={({ item, index }) => (
            <Entering index={index}>
              <TrophyRow trophy={item} />
            </Entering>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  card: { padding: SPACE.md, marginBottom: SPACE.md },
  row: { flexDirection: 'row', gap: SPACE.md },
  photo: { width: 64, height: 64, borderRadius: RADIUS.md },
  photoPlaceholder: { backgroundColor: SURFACE.raised, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, justifyContent: 'center', gap: SPACE.xs },
  title: { color: INK.primary, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg },
  subtitle: { color: INK.dim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  date: { color: INK.dim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  starsRow: { flexDirection: 'row', gap: SPACE.hair },
  skeletonRow: { flexDirection: 'row', gap: SPACE.md, padding: SPACE.md },
  skeletonInfo: { flex: 1, justifyContent: 'center', gap: SPACE.xs },
  charted: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  chartedText: { color: ACCENT.base, fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm },
  waypointsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.lg },
  waypointsText: { flex: 1, color: INK.dim, fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md },
  unrated: { color: INK.dim, fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, marginTop: SPACE.hair },
});
