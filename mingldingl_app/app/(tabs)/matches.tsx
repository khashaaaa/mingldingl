import { View, Text, FlatList, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Spinner } from 'tamagui';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMatches } from '../../hooks/useMatches';
import { QuestTile } from '../../components/quest/QuestTile';
import { GameHeader } from '../../components/ui/GameHeader';
import { Icon } from '../../components/ui/Icon';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { FogDrift } from '../../components/vfx/FogDrift';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function MatchesScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { data: matches, isLoading } = useMatches();
  const router = useRouter();
  const [emptySize, setEmptySize] = useState({ w: 0, h: 0 });

  function onEmptyLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setEmptySize({ w: width, h: height });
  }

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <GameHeader title={i18n.t('tab_quest_log')} icon="bone" showScore />
      {isLoading && (
        <View style={styles.center}>
          <Spinner color="$gold" />
        </View>
      )}
      {!isLoading && (!matches || matches.length === 0) && (
        <View style={styles.center} onLayout={onEmptyLayout}>
          {emptySize.w > 0 && <FogDrift width={emptySize.w} height={emptySize.h} />}
          <Icon name="skull-outline" size={36} color={COLORS.bronze} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{i18n.t('no_quests')}</Text>
          <Text style={styles.emptySub}>{i18n.t('no_quests_sub')}</Text>
        </View>
      )}
      {matches && matches.length > 0 && (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.matchId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <QuestTile
              match={item}
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
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  emptyIcon: { opacity: 0.6, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bodyBold, color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textDim, fontFamily: FONTS.body },
});
