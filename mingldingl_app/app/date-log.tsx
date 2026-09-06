import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useMyTrophies } from '../hooks/useMyTrophies';
import { GameHeader } from '../components/ui/GameHeader';
import { GameButton } from '../components/ui/GameButton';
import { AppCard } from '../components/ui/AppCard';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE } from '../lib/theme';
import type { Trophy } from '../models/trophy';
import { Icon } from '../components/ui/Icon';
import { useScrollTail } from '../hooks/useScrollTail';


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
          <Text style={styles.date}>{formatDate(trophy.confirmedAt)}</Text>
          {trophy.mismatched ? (
            <Text style={styles.unrated}>{i18n.t('date_log_unconfirmed')}</Text>
          ) : trophy.myStars ? (
            <View style={styles.starsRow}>
              {Array.from({ length: trophy.myStars }).map((_, i) => (
                <Icon key={i} name="star" size={ICON_SIZES.sm} color={COLORS.gold} />
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

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('date_log_title')} icon="book-heart" showBack />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      ) : isError ? (
        <View style={styles.errorWrap}>
          <Icon name="alert-circle-outline" size={ICON_SIZES.huge} color={INK.muted} />
          <Text style={styles.errorText}>{i18n.t('screen_load_error')}</Text>
          <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[(trophies ?? []).length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
          data={trophies ?? []}
          keyExtractor={(t) => t.matchId}
          ListEmptyComponent={<Text style={styles.empty}>{i18n.t('date_log_empty')}</Text>}
          renderItem={({ item }) => <TrophyRow trophy={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.md },
  errorText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, textAlign: 'center' },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  empty: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, textAlign: 'center' },
  card: { padding: SPACE.md, marginBottom: SPACE.md },
  row: { flexDirection: 'row', gap: SPACE.md },
  photo: { width: 64, height: 64, borderRadius: RADIUS.md },
  photoPlaceholder: { backgroundColor: COLORS.panelRaised, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, justifyContent: 'center', gap: SPACE.xs },
  title: { color: COLORS.text, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg },
  subtitle: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  date: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  starsRow: { flexDirection: 'row', gap: SPACE.hair },
  unrated: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, fontStyle: 'italic', marginTop: SPACE.hair },
});
