import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useBusinessReviews } from '../../hooks/useBusinessReviews';
import { AppCard } from '../../components/ui/AppCard';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function BusinessDetailScreen() {
  useLocaleStore((s) => s.locale);
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    description?: string;
    category?: string;
    district?: string;
    photo?: string;
    averageRating?: string;
    ratingCount?: string;
    operatingHours?: string;
  }>();
  const { reviews, isLoading } = useBusinessReviews(params.id);

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={params.name ?? ''} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {params.photo ? (
          <Image source={{ uri: params.photo }} style={styles.hero} contentFit="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]} />
        )}

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{params.category} · {params.district}</Text>
          <Icon name="star" size={ICON_SIZES.sm} color={COLORS.gold} />
          <Text style={styles.rating}>{Number(params.averageRating ?? 0).toFixed(1)} ({params.ratingCount ?? 0})</Text>
        </View>

        {params.description ? <Text style={styles.description}>{params.description}</Text> : null}

        {params.operatingHours ? (
          <Text style={styles.hours}>{i18n.t('operating_hours')}: {params.operatingHours}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>{i18n.t('memorable_moments')}</Text>

        {isLoading ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : !reviews || reviews.length === 0 ? (
          <Text style={styles.emptyText}>{i18n.t('no_moments_yet')}</Text>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((r, i) => (
              <AppCard key={i} style={styles.reviewCard}>
                {r.photoUrl && (
                  <Image source={{ uri: r.photoUrl }} style={styles.reviewPhoto} contentFit="cover" />
                )}
                <View style={styles.reviewStarsRow}>
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <Icon key={i} name="star" size={ICON_SIZES.xs} color={COLORS.gold} />
                  ))}
                </View>
                {r.review ? <Text style={styles.reviewText}>{r.review}</Text> : null}
              </AppCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: SPACE.scrollTail },
  hero: { width: '100%', height: 200 },
  heroPlaceholder: { backgroundColor: COLORS.panelRaised },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACE.gutter, marginTop: SPACE.md,
  },
  meta: { color: COLORS.textDim, fontSize: FONT_SIZES.md, fontFamily: FONTS.body },
  rating: { color: COLORS.gold, fontSize: FONT_SIZES.md, fontFamily: FONTS.bodyBold },
  description: { color: COLORS.text, fontSize: FONT_SIZES.md, fontFamily: FONTS.body, lineHeight: LINE_HEIGHTS.md, paddingHorizontal: SPACE.gutter, marginTop: SPACE.md },
  hours: { color: COLORS.textDim, fontSize: FONT_SIZES.md, fontFamily: FONTS.body, paddingHorizontal: SPACE.gutter, marginTop: SPACE.sm },
  sectionTitle: {
    color: COLORS.gold, fontSize: FONT_SIZES.md, fontFamily: FONTS.display, letterSpacing: 1,
    textTransform: 'uppercase', paddingHorizontal: SPACE.gutter, marginTop: SPACE.xxl, marginBottom: SPACE.md,
  },
  emptyText: { color: COLORS.textDim, fontSize: FONT_SIZES.md, fontFamily: FONTS.body, paddingHorizontal: SPACE.gutter },
  reviewList: { paddingHorizontal: SPACE.gutter, gap: SPACE.md },
  reviewCard: { padding: SPACE.md, gap: SPACE.sm },
  reviewPhoto: { width: '100%', height: 160, borderRadius: RADIUS.sm },
  reviewStarsRow: { flexDirection: 'row', gap: SPACE.hair },
  reviewText: { color: COLORS.text, fontSize: FONT_SIZES.md, fontFamily: FONTS.body, lineHeight: LINE_HEIGHTS.md },
});
