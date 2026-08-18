import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Spinner } from 'tamagui';
import { useBusinessReviews } from '../../hooks/useBusinessReviews';
import { AppCard } from '../../components/ui/AppCard';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function BusinessDetailScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
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
          <Text style={styles.rating}>⭐ {Number(params.averageRating ?? 0).toFixed(1)} ({params.ratingCount ?? 0})</Text>
        </View>

        {params.description ? <Text style={styles.description}>{params.description}</Text> : null}

        {params.operatingHours ? (
          <Text style={styles.hours}>{i18n.t('operating_hours')}: {params.operatingHours}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>{i18n.t('memorable_moments')}</Text>

        {isLoading ? (
          <Spinner color="$gold" />
        ) : !reviews || reviews.length === 0 ? (
          <Text style={styles.emptyText}>{i18n.t('no_moments_yet')}</Text>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((r, i) => (
              <AppCard key={i} style={styles.reviewCard}>
                {r.photoUrl && (
                  <Image source={{ uri: r.photoUrl }} style={styles.reviewPhoto} contentFit="cover" />
                )}
                <Text style={styles.reviewStars}>{'⭐'.repeat(r.stars)}</Text>
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
  content: { paddingBottom: 40 },
  hero: { width: '100%', height: 200 },
  heroPlaceholder: { backgroundColor: COLORS.panelRaised },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 12,
  },
  meta: { color: COLORS.textDim, fontSize: 13, fontFamily: FONTS.body },
  rating: { color: COLORS.gold, fontSize: 13, fontFamily: FONTS.bodyBold },
  description: { color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, lineHeight: 20, paddingHorizontal: 20, marginTop: 12 },
  hours: { color: COLORS.textDim, fontSize: 13, fontFamily: FONTS.body, paddingHorizontal: 20, marginTop: 8 },
  sectionTitle: {
    color: COLORS.gold, fontSize: 13, fontFamily: FONTS.display, letterSpacing: 1,
    textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  emptyText: { color: COLORS.textDim, fontSize: 13, fontFamily: FONTS.body, paddingHorizontal: 20 },
  reviewList: { paddingHorizontal: 20, gap: 12 },
  reviewCard: { padding: 12, gap: 8 },
  reviewPhoto: { width: '100%', height: 160, borderRadius: RADIUS.sm },
  reviewStars: { fontSize: 14 },
  reviewText: { color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, lineHeight: 19 },
});
