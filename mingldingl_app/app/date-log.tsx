import { View, Text, Image, FlatList, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
import { useMyTrophies } from '../hooks/useMyTrophies';
import { GameHeader } from '../components/ui/GameHeader';
import { AppCard } from '../components/ui/AppCard';
import { TiledBackdrop } from '../components/ui/TiledBackdrop';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import type { Trophy } from '../models/trophy';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

function TrophyRow({ trophy }: { trophy: Trophy }) {
  const photo = trophy.myMomentPhotoUrl ?? trophy.businessPhoto;
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{trophy.businessName ?? trophy.activityTitle}</Text>
          {trophy.businessName && (
            <Text style={styles.subtitle} numberOfLines={1}>{trophy.activityTitle}</Text>
          )}
          <Text style={styles.date}>{formatDate(trophy.confirmedAt)}</Text>
          {trophy.myStars ? (
            <Text style={styles.stars}>{'⭐'.repeat(trophy.myStars)}</Text>
          ) : (
            <Text style={styles.unrated}>{i18n.t('date_log_unrated')}</Text>
          )}
        </View>
      </View>
    </AppCard>
  );
}

export default function DateLogScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { data: trophies, isLoading } = useMyTrophies();

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <GameHeader title={i18n.t('date_log_title')} icon="book-heart" showBack toastBottomOffset={0} />
      {isLoading ? (
        <View style={styles.centered}>
          <Spinner color="$gold" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={(trophies ?? []).length === 0 ? styles.listEmpty : styles.list}
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
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  empty: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
  card: { padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  photo: { width: 64, height: 64, borderRadius: RADIUS.md },
  photoPlaceholder: { backgroundColor: COLORS.panelRaised },
  info: { flex: 1, justifyContent: 'center', gap: 3 },
  title: { color: COLORS.text, fontFamily: FONTS.bodyBold, fontSize: 15 },
  subtitle: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 12 },
  date: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 11 },
  stars: { fontSize: 13, marginTop: 2 },
  unrated: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});
