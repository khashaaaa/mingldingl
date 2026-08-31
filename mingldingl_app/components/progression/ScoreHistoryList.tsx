import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { i18n } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
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

type EventGlyph = React.ComponentProps<typeof Icon>['name'];

const EVENT_ICONS: Record<string, EventGlyph> = {
  ProfileComplete: 'account-edit', DailyLogin: 'weather-sunny', FirstMessage: 'message-text',
  IcebreakerDone: 'snowflake', QuizDone: 'script-text', MatchReply: 'keyboard-return',
  DateConfirmed: 'map-marker', VideoCallDone: 'video', GhostPenalty: 'ghost',
  ReportPenalty: 'alert', ShipSparked: 'bow-arrow', QuestComplete: 'target',
  QuestChest: 'gift', MilestoneChest: 'medal', DuplicateLoot: 'recycle',
  AdminAdjustment: 'scale-balance',
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
        const icon: EventGlyph = EVENT_ICONS[item.eventType] ?? 'star-four-points';
        const sign = item.delta >= 0 ? '+' : '';
        const color = item.delta >= 0 ? COLORS.gold : COLORS.ember;
        const date = formatDate(item.createdAt);
        return (
          <View style={styles.row}>
            <Icon name={icon} size={16} color={COLORS.textDim} style={styles.icon} />
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
  icon: { width: 18, textAlign: 'center' },
  type: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.text },
  delta: { fontSize: 14, fontFamily: FONTS.bodyBold },
  date: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim },
  footer: { marginVertical: 16 },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
