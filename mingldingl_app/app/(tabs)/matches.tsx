import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMatches } from '../../hooks/useMatches';
import { QuestTile } from '../../components/quest/QuestTile';
import { GameHeader } from '../../components/ui/GameHeader';
import { NextGatheringPill } from '../../components/townsquare/NextGatheringPill';
import { Icon } from '../../components/ui/Icon';
import { GameButton } from '../../components/ui/GameButton';
import { FogDrift } from '../../components/vfx/FogDrift';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';


export default function MatchesScreen() {
  useLocaleStore((s) => s.locale);
  const { data: matches, isLoading, isError, isRefetching, refetch } = useMatches();
  const router = useRouter();
  const [emptySize, setEmptySize] = useState({ w: 0, h: 0 });

  function onEmptyLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setEmptySize({ w: width, h: height });
  }

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('tab_quest_log')} icon="script-text" showScore />
      <NextGatheringPill />
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      )}
      {!isLoading && isError && (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={ICON_SIZES.huge} color={INK.muted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{i18n.t('screen_load_error')}</Text>
          <GameButton size="compact" onPress={() => refetch()} style={styles.emptyCta}>
            {i18n.t('retry')}
          </GameButton>
        </View>
      )}
      {!isLoading && !isError && (!matches || matches.length === 0) && (
        <View style={styles.center} onLayout={onEmptyLayout}>
          {emptySize.w > 0 && <FogDrift width={emptySize.w} height={emptySize.h} />}
          <Icon name="skull-outline" size={ICON_SIZES.huge} color={INK.muted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{i18n.t('no_quests')}</Text>
          <Text style={styles.emptySub}>{i18n.t('no_quests_sub')}</Text>
          <GameButton size="compact" onPress={() => router.push('/(tabs)/discover')} style={styles.emptyCta}>
            {i18n.t('seek_title')}
          </GameButton>
        </View>
      )}
      {!isError && matches && matches.length > 0 && (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.matchId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.gold} colors={[COLORS.gold]} />
          }
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm },
  emptyIcon: { opacity: 0.6, marginBottom: SPACE.xs },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontFamily: FONTS.bodyBold, color: COLORS.text },
  emptySub: { fontSize: FONT_SIZES.md, color: COLORS.textDim, fontFamily: FONTS.body },
  emptyCta: { marginTop: SPACE.lg },
});
