import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useBusiness } from '../../hooks/useBusiness';
import { useBusinessReviews } from '../../hooks/useBusinessReviews';
import { AppCard } from '../../components/ui/AppCard';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';
import { useScrollTail } from '../../hooks/useScrollTail';


export default function BusinessDetailScreen() {
  const tail = useScrollTail();
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
  const { business } = useBusiness(params.id);

  // The Mission Board hands the whole venue over in params, so the screen paints instantly with
  // no spinner. Every other way in — deep link, shared URL, reload, restored session — arrives
  // with nothing but the id, and the fetch is what fills the screen.
  const name = params.name ?? business?.name ?? '';
  const category = params.category ?? business?.category ?? '';
  const district = params.district ?? business?.district ?? '';
  const description = params.description ?? business?.description ?? '';
  const photo = params.photo || business?.photoUrl || '';
  const operatingHours = params.operatingHours ?? business?.operatingHours ?? '';
  const averageRating = Number(params.averageRating ?? business?.averageRating ?? 0);
  const ratingCount = Number(params.ratingCount ?? business?.ratingCount ?? 0);
  const hasMeta = !!category || !!district;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={name} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.hero} contentFit="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Icon name="map-marker-star" size={ICON_SIZES.splash} color={INK.muted} />
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {hasMeta ? [category, district].filter(Boolean).join(' · ') : ''}
          </Text>
          <Icon name="star" size={ICON_SIZES.sm} color={COLORS.gold} />
          <Text style={styles.rating}>{averageRating.toFixed(1)} ({ratingCount})</Text>
        </View>

        {description ? <Text style={styles.description}>{description}</Text> : null}

        {operatingHours ? (
          <Text style={styles.hours}>{i18n.t('operating_hours')}: {operatingHours}</Text>
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: SPACE.scrollTail },
  hero: { width: '100%', height: 200 },
  // Venues routinely have no photo — a bare 200px slab read as a broken image.
  heroPlaceholder: { backgroundColor: COLORS.panelRaised, alignItems: 'center', justifyContent: 'center' },
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
