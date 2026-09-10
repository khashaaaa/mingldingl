import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { GameButton } from '../components/ui/GameButton';
import { HeaderBar } from '../components/ui/HeaderBar';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, circle } from '../lib/theme';
import type { BlockedUser } from '../models/blockedUser';
import { useScrollTail } from '../hooks/useScrollTail';


export default function BlockedUsersScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { blockedUsers, isLoading, isError, refetch, unblock, unblockingUserId } = useBlockedUsers();

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('blocked_users_title')} />
      {isLoading ? (
        <View style={styles.list}>
          <SkeletonRows count={3} gap={SPACE.md} row={() => (
            <View style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={RADIUS.pill} />
              <Skeleton width="50%" height={FONT_SIZES.md} />
            </View>
          )} />
        </View>
      ) : isError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{i18n.t('screen_load_error')}</Text>
          <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[blockedUsers.length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.md },
  errorText: { color: INK.primary, fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, textAlign: 'center' },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  empty: { color: INK.dim, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: LINE.edge,
    marginBottom: SPACE.md,
  },
  photo: circle(44),
  photoPlaceholder: { backgroundColor: COLORS.panelRaised },
  name: { flex: 1, color: INK.primary, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
  },
});
