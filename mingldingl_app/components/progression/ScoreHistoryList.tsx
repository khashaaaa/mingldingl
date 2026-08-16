import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { i18n } from '../../lib/i18n';
import { formatDate } from '../../lib/formatDate';
import { COLORS, FONTS } from '../../lib/theme';

interface ScoreEventItem {
  eventType: string;
  delta: number;
  createdAt: string;
}

interface Props {
  items: ScoreEventItem[];
  onEndReached: () => void;
  isFetchingNextPage: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  ProfileComplete: '📝', DailyLogin: '☀️', FirstMessage: '💬', IcebreakerDone: '🧊',
  QuizDone: '📜', MatchReply: '↩️', DateConfirmed: '📍',
  VideoCallDone: '🎥', GhostPenalty: '👻', ReportPenalty: '⚠️',
  ShipSparked: '🏹', QuestComplete: '🎯',
  QuestChest: '🎁', MilestoneChest: '🏅', DuplicateLoot: '♻️', AdminAdjustment: '⚖️',
};

const EVENT_TYPE_KEYS: Record<string, string> = {
  ProfileComplete: 'event_profile_complete',
  DailyLogin: 'event_daily_login',
  FirstMessage: 'event_first_message',
  IcebreakerDone: 'event_icebreaker_done',
  QuizDone: 'event_quiz_done',
  MatchReply: 'event_match_reply',
  DateConfirmed: 'event_date_confirmed',
  VideoCallDone: 'event_video_call_done',
  GhostPenalty: 'event_ghost_penalty',
  ReportPenalty: 'event_report_penalty',
  ShipSparked: 'event_ship_sparked',
  QuestComplete: 'event_quest_complete',
  QuestChest: 'event_quest_chest',
  MilestoneChest: 'event_milestone_chest',
  DuplicateLoot: 'event_duplicate_loot',
  AdminAdjustment: 'event_admin_adjustment',
};

export function ScoreHistoryList({ items, onEndReached, isFetchingNextPage }: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{i18n.t('no_score_events')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => `${item.eventType}-${item.createdAt}-${index}`}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={COLORS.gold} style={styles.footer} /> : null}
      renderItem={({ item }) => {
        const icon = EVENT_ICONS[item.eventType] ?? '✦';
        const sign = item.delta >= 0 ? '+' : '';
        const color = item.delta >= 0 ? COLORS.gold : COLORS.ember;
        const date = formatDate(item.createdAt);
        return (
          <View style={styles.row}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.type}>{i18n.t(EVENT_TYPE_KEYS[item.eventType] ?? item.eventType)}</Text>
            <Text style={[styles.delta, { color }]}>{sign}{item.delta}</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.panelRaised,
  },
  icon: { fontSize: 16 },
  type: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.text },
  delta: { fontSize: 14, fontFamily: FONTS.bodyBold },
  date: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim },
  footer: { marginVertical: 16 },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
