import { View, Text, Image, FlatList, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { GameButton } from '../components/ui/GameButton';
import { TiledBackdrop } from '../components/ui/TiledBackdrop';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import type { BlockedUser } from '../models/blockedUser';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

export default function BlockedUsersScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { blockedUsers, isLoading, unblock, unblockingUserId } = useBlockedUsers();

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={i18n.t('blocked_users_title')} />
      {isLoading ? (
        <View style={styles.centered}>
          <Spinner color="$gold" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={blockedUsers.length === 0 ? styles.listEmpty : styles.list}
          data={blockedUsers}
          keyExtractor={(u: BlockedUser) => u.userId}
          ListEmptyComponent={<Text style={styles.empty}>{i18n.t('blocked_users_empty')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.firstPhoto ? (
                <Image source={{ uri: item.firstPhoto }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]} />
              )}
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName || i18n.t('deleted_user')}
              </Text>
              <GameButton
                variant="ghost"
                loading={unblockingUserId === item.userId}
                onPress={() => unblock(item.userId)}
              >
                {i18n.t('unblock')}
              </GameButton>
            </View>
          )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    marginBottom: 10,
  },
  photo: { width: 44, height: 44, borderRadius: 22 },
  photoPlaceholder: { backgroundColor: COLORS.panelRaised },
  name: { flex: 1, color: COLORS.text, fontFamily: FONTS.bodyBold, fontSize: 14 },
});
