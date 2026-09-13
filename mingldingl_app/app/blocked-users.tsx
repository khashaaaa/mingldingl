import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { GameButton } from '../components/ui/GameButton';
import { HeaderBar } from '../components/ui/HeaderBar';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, circle } from '../lib/theme';
import { StateBlock } from '../components/ui/StateBlock';
import { FrostEdge } from '../components/vfx/FrostEdge';
import { ordinalWord, threadDay } from '../lib/worldTime';
import type { BlockedUser } from '../models/blockedUser';
import { useScrollTail } from '../hooks/useScrollTail';

/** How far the left `FrostEdge` reaches in from the edge — the same reach `QuestTile` gives its
 *  own left edge (see `components/quest/QuestTile.tsx`'s `FROST_REACH`), not the row's height. */
const FROST_REACH = 84;

export default function BlockedUsersScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { blockedUsers, isLoading, isError, refetch, unblock, unblockingUserId } = useBlockedUsers();
  const now = new Date().toISOString();

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('blocked_users_title')} />
      <Text style={styles.sub}>{i18n.t('frozen_gate_sub')}</Text>
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
        <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
          <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        </StateBlock>
      ) : (
        <FlatList
          contentContainerStyle={[blockedUsers.length === 0 ? styles.listEmpty : styles.list, { paddingBottom: tail }]}
          data={blockedUsers}
          keyExtractor={(u: BlockedUser) => u.userId}
          ListEmptyComponent={<StateBlock icon="door" title={i18n.t('blocked_users_empty')} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {/* Every name here was shut out, not just some — unlike the Quest Log's `frozen`
                  fire, this frost is unconditional. */}
              <View style={styles.frostWrap} pointerEvents="none">
                <FrostEdge edge="left" length={FROST_REACH} />
              </View>
              {item.firstPhoto ? (
                <Image source={{ uri: item.firstPhoto }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]} />
              )}
              <View style={styles.nameCol}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName || i18n.t('deleted_user')}
                </Text>
                {/* `blockedAt` is empty for a row the engine could not date — no dawn line rather
                    than one built off `new Date('')`. */}
                {!!item.blockedAt && (
                  <Text style={styles.dawn}>
                    {i18n.t('shut_out_dawn', { day: ordinalWord(threadDay(now, item.blockedAt)) })}
                  </Text>
                )}
              </View>
              <GameButton
                variant="ink"
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
  // The app speaking, not either person in this list — same register as the Quest Log's own
  // `law` line (`app/(tabs)/matches.tsx`).
  sub: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.sm,
    color: INK.dim,
    paddingHorizontal: SPACE.gutter,
    paddingBottom: SPACE.sm,
  },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.scrollTail },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: SURFACE.panel,
    borderWidth: 1,
    borderColor: LINE.edge,
    marginBottom: SPACE.md,
    overflow: 'hidden',
  },
  frostWrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  photo: circle(44),
  photoPlaceholder: { backgroundColor: SURFACE.raised },
  nameCol: { flex: 1, gap: SPACE.hair },
  name: { color: INK.primary, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md },
  dawn: { color: INK.dim, fontFamily: FONTS.body, fontSize: FONT_SIZES.xs },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
  },
});
