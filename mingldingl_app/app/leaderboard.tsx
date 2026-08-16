import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
import { useRouter } from 'expo-router';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { GameHeader } from '../components/ui/GameHeader';
import { GameButton } from '../components/ui/GameButton';
import { GemTierBadge } from '../components/progression/GemTierBadge';
import { TiledBackdrop } from '../components/ui/TiledBackdrop';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import type { GemTier } from '../models/user';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

// >50 means the caller's own row was appended past the top-50 slice (see
// ScoresController.GetLeaderboard) — render a gap before it instead of a
// false "#51" implying an unbroken sequence.
const TOP_SLICE_SIZE = 50;

export default function LeaderboardScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const router = useRouter();
  const { data, isLoading, error, refetch } = useLeaderboard();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Spinner color="$gold" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{i18n.t('leaderboard_load_error')}</Text>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
      </View>
    );
  }

  const entries = data.entries ?? [];
  const ownRowDetached = data.myRank != null && data.myRank > TOP_SLICE_SIZE;

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <GameHeader title={i18n.t('leaderboard_title', { city: data.city ?? '' })} icon="podium-gold" showBack toastBottomOffset={0} />
      <FlatList
        contentContainerStyle={entries.length === 0 ? styles.listEmpty : styles.list}
        data={entries}
        keyExtractor={(item, i) => `${item.rank ?? i}`}
        ListEmptyComponent={<Text style={styles.empty}>{i18n.t('leaderboard_empty')}</Text>}
        renderItem={({ item, index }) => {
          const showGap = ownRowDetached && item.isCurrentUser && index > 0;
          return (
            <>
              {showGap && <Text style={styles.gap}>···</Text>}
              <View style={[styles.row, item.isCurrentUser && styles.rowSelf]}>
                <Text style={[styles.rank, item.isCurrentUser && styles.rankSelf]}>#{item.rank}</Text>
                <GemTierBadge tier={(item.gemTier as GemTier) ?? 'Garnet'} size={28} />
                {item.isCurrentUser && <Text style={styles.youTag}>{i18n.t('leaderboard_you')}</Text>}
              </View>
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorTitle: { color: COLORS.text, fontSize: 18, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  empty: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
  gap: { color: COLORS.textDim, textAlign: 'center', fontFamily: FONTS.display, fontSize: 16, marginVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  rowSelf: {
    backgroundColor: COLORS.panelRaised,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  rank: { width: 40, fontFamily: FONTS.display, fontSize: 15, color: COLORS.textDim },
  rankSelf: { color: COLORS.gold },
  youTag: {
    marginLeft: 'auto',
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.gold,
  },
});
