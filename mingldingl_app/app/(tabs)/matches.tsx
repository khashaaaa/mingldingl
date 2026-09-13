import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMatches } from '../../hooks/useMatches';
import { useMyUserId } from '../../hooks/useMyUserId';
import { useNowTicker } from '../../hooks/useNowTicker';
import { useGhostingWindows } from '../../hooks/useRevealThresholds';
import { fireOf } from '../../lib/fire';
import { QuestTile } from '../../components/quest/QuestTile';
import { GameHeader } from '../../components/ui/GameHeader';
import { NextGatheringPill } from '../../components/townsquare/NextGatheringPill';
import { GameButton } from '../../components/ui/GameButton';
import { Entering } from '../../components/ui/Entering';
import { Skeleton, SkeletonRows } from '../../components/ui/Skeleton';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { ACCENT, FONTS, FONT_SIZES, INK, RADIUS, SPACE } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';

export default function MatchesScreen() {
  useLocaleStore((s) => s.locale);
  const { data: matches, isLoading, isError, isRefetching, refetch } = useMatches();
  const router = useRouter();
  const myId = useMyUserId();
  const windows = useGhostingWindows();
  // Fires-driven state (`lib/fire.ts`) turns over purely with time, so this screen needs `now` to
  // actually change on its own — see `useNowTicker`'s own comment.
  const now = useNowTicker();

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('tab_quest_log')} glyph="letters" showScore />
      <NextGatheringPill />
      {isLoading && (
        <View style={styles.list}>
          <SkeletonRows count={5} row={() => (
            <View style={styles.rowShape}>
              <Skeleton width={56} height={56} radius={RADIUS.pill} />
              <View style={styles.rowLines}>
                <Skeleton width="55%" height={FONT_SIZES.lg} />
                <Skeleton width="80%" height={FONT_SIZES.md} />
              </View>
            </View>
          )} />
        </View>
      )}
      {!isLoading && isError && (
        <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
          <GameButton variant="ink" size="compact" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
        </StateBlock>
      )}
      {!isLoading && !isError && (!matches || matches.length === 0) && (
        <StateBlock
        fog
          icon="skull-outline"
          title={i18n.t('no_quests')}
          body={i18n.t('no_quests_sub')}
        >
          <GameButton size="compact" onPress={() => router.push('/(tabs)/discover')}>
            {i18n.t('seek_title')}
          </GameButton>
        </StateBlock>
      )}
      {!isError && matches && matches.length > 0 && (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.matchId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ACCENT.base} colors={[ACCENT.base]} />
          }
          ListFooterComponent={
            <Text style={styles.law}>{i18n.t('fire_law')}</Text>
          }
          renderItem={({ item, index }) => (
            <Entering index={index}>
              <QuestTile
                match={item}
                fire={fireOf(item, myId, now, windows)}
                onPress={() => router.push({
                  pathname: `/chat/${item.matchId}` as any,
                  params: {
                    name: item.otherUser.isDeleted
                      ? i18n.t('deleted_user')
                      : item.revealLevel >= 2
                        ? (item.otherUser.displayName ?? '')
                        : i18n.t('mystery_match_name'),
                    wovenBy: item.weaverDisplayName ?? '',
                  },
                })}
              />
            </Entering>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm },
  rowShape: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  rowLines: { flex: 1, gap: SPACE.xs },
  // The app speaking, not either person in a thread — same register as SealsSheet's own `law`.
  law: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.dim, textAlign: 'center', padding: SPACE.lg },
});
