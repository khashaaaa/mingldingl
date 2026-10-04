import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMatches } from '../../hooks/useMatches';
import { useMyUserId } from '../../hooks/useMyUserId';
import { useNowTicker } from '../../hooks/useNowTicker';
import { useGhostingWindows } from '../../hooks/useRevealThresholds';
import { fireMark, fireOf, type Fire } from '../../lib/fire';
import { matchName } from '../../lib/reveal';
import type { Match } from '../../models/match';
import { QuestTile } from '../../components/quest/QuestTile';
import { GameHeader } from '../../components/ui/GameHeader';
import { GameButton } from '../../components/ui/GameButton';
import { Entering } from '../../components/ui/Entering';
import { Skeleton, SkeletonRows } from '../../components/ui/Skeleton';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, TEMPERATURE, tint } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';
import { useGoTo } from '../../hooks/useGoTo';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { CardEyebrow } from '../../components/ui/CardEyebrow';
import { FireMarkGlyph } from '../../components/quest/FireMarkGlyph';
import { InkBleed } from '../../components/vfx/InkBleed';

type Entry =
  | { kind: 'quest'; match: Match; fire: Fire; first: boolean; last: boolean }
  | { kind: 'cold' };

/** Live fires first, as one thread; the frozen ones sink below a mark of their own, a second
 *  thread gone to ice. Order inside each keeps the engine's. */
function thread(matches: Match[], fireFor: (m: Match) => Fire): Entry[] {
  const all = matches.map((match) => ({ match, fire: fireFor(match) }));
  const strand = (xs: typeof all): Entry[] =>
    xs.map((x, i) => ({ kind: 'quest', ...x, first: i === 0, last: i === xs.length - 1 }));
  const live = all.filter((x) => x.fire.state !== 'frozen');
  const cold = all.filter((x) => x.fire.state === 'frozen');
  return [...strand(live), ...(cold.length ? [{ kind: 'cold' } as const] : []), ...strand(cold)];
}

export default function MatchesScreen() {
  useLocaleStore((s) => s.locale);
  const { data: matches, isLoading, isError, refetch } = useMatches();
  const go = useGoTo();
  useRefreshOnFocus(refetch);
  // A tab mounts when it is opened, so it starts focused; leaving it is what turns this off.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const myId = useMyUserId();
  const windows = useGhostingWindows();
  // Fires-driven state (`lib/fire.ts`) turns over purely with time, so this screen needs `now` to
  // actually change on its own — see `useNowTicker`'s own comment.
  const now = useNowTicker();
  const entries = matches ? thread(matches, (m) => fireOf(m, myId, now, windows)) : [];

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('tab_quest_log')} />
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
          <GameButton size="compact" onPress={() => go('/(tabs)/discover')}>
            {i18n.t('seek_title')}
          </GameButton>
        </StateBlock>
      )}
      {!isError && matches && matches.length > 0 && (
        <FlatList
          data={entries}
          extraData={focused}
          keyExtractor={(e) => (e.kind === 'quest' ? e.match.matchId : 'gone-cold')}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <Text style={styles.law}>{i18n.t('fire_law')}</Text>
          }
          renderItem={({ item, index }) => item.kind === 'cold' ? (
            <View style={styles.coldMark} testID="quest-log-gone-cold">
              <View style={styles.coldRule} />
              <FireMarkGlyph mark={fireMark('frozen')} size={ICON_SIZES.sm} />
              <CardEyebrow color={fireMark('frozen').color} style={styles.coldLabel}>{i18n.t('quest_log_gone_cold')}</CardEyebrow>
              <View style={styles.coldRule} />
            </View>
          ) : (
            <Entering index={index}>
              <NewQuestBleed matchId={item.match.matchId} unopened={item.fire.state === 'unlit'} focused={focused}>
                <QuestTile
                  match={item.match}
                  fire={item.fire}
                  first={item.first}
                  last={item.last}
                  onPress={() => go({
                    pathname: `/chat/${item.match.matchId}` as any,
                    params: {
                      name: matchName(item.match),
                      wovenBy: item.match.weaverDisplayName ?? '',
                    },
                  })}
                />
              </NewQuestBleed>
            </Entering>
          )}
        />
      )}
    </View>
  );
}

/** Quests already shown this session, so a new one bleeds in once and not on every visit. */
const SIGHTED = new Set<string>();

/**
 * A quest no one has opened yet soaks into the log like ink, the first time it is seen. Seen, not
 * rendered: the log stays mounted under a chat and behind the other tabs, and a match arriving
 * there bled in unseen and came back plain. It waits for the log to be on screen.
 */
function NewQuestBleed({ matchId, unopened, focused, children }: { matchId: string; unopened: boolean; focused: boolean; children: ReactNode }) {
  const [bleed] = useState(() => unopened && !SIGHTED.has(matchId));
  useEffect(() => { if (focused) SIGHTED.add(matchId); }, [focused, matchId]);
  return <InkBleed bleed={bleed} hold={!focused}>{children}</InkBleed>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm },
  rowShape: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  rowLines: { flex: 1, gap: SPACE.xs },
  coldMark: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xl, marginBottom: SPACE.sm },
  coldRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tint(TEMPERATURE.glacier, 0.4) },
  coldLabel: { marginBottom: 0 },
  // The app speaking, not either person in a thread — same register as SealsSheet's own `law`.
  law: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.dim, textAlign: 'center', padding: SPACE.lg },
});
