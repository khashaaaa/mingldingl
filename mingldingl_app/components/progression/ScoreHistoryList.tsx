import { SectionList, View, Text, StyleSheet } from 'react-native';
import { i18n, tKey } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { formatDate } from '../../lib/formatDate';
import { ordinalWord, threadDay } from '../../lib/worldTime';
import { Waiting } from '../ui/Waiting';
import { Entering } from '../ui/Entering';
import { CardEyebrow } from '../ui/CardEyebrow';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, METAL, SPACE, SURFACE } from '../../lib/theme';
import { EmptyHint } from '../ui/StateBlock';
interface ScoreEventItem {
  eventType: string;
  delta: number;
  createdAt: string;
}

interface Props {
  items: ScoreEventItem[];
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** The wanderer's join date (`UserProfile.joinedAt`), so days can be worded as dawns like the
   *  hearth's own heading. Absent while the profile is still loading — the list then falls back
   *  to the plain date, same as before this became a SectionList. */
  joinedAt?: string;
}

type EventGlyph = React.ComponentProps<typeof Icon>['name'];

/**
 * Every `ScoreEvent.EventType` the engine can write, mirrored from its award call sites
 * (`ScoreService.AwardAsync` / `AwardWithDeltaAsync` / `TryAwardClaimedAsync` / `AwardManyAsync`
 * and `ApplyReputationPenaltyAsync`). There is no shared schema between the two sides, so this
 * list plus its test is what keeps the maps below from falling behind the engine.
 */
export const ENGINE_EVENT_TYPES = [
  'ProfileComplete', 'DailyLogin', 'FirstMessage', 'IcebreakerDone', 'QuizDone', 'MatchReply',
  'DateConfirmed', 'VideoCallDone', 'ShipSparked', 'OathProven', 'GhostPenalty',
  'RepeatedNoShowPenalty', 'QuestComplete', 'QuestChest', 'MilestoneChest', 'DuplicateLoot',
  'AdminAdjustment', 'CampaignRoomBonus', 'CampaignBossBonus',
] as const;

export const EVENT_ICONS: Record<string, EventGlyph> = {
  ProfileComplete: 'account-edit', DailyLogin: 'weather-sunny', FirstMessage: 'message-text',
  IcebreakerDone: 'snowflake', QuizDone: 'script-text', MatchReply: 'keyboard-return',
  DateConfirmed: 'map-marker', VideoCallDone: 'video', GhostPenalty: 'ghost',
  ReportPenalty: 'alert', ShipSparked: 'bow-arrow', QuestComplete: 'target',
  QuestChest: 'gift', MilestoneChest: 'medal', DuplicateLoot: 'recycle',
  AdminAdjustment: 'scale-balance', OathProven: 'seal-variant',
  RepeatedNoShowPenalty: 'account-cancel',
  CampaignRoomBonus: 'map-marker-path', CampaignBossBonus: 'trophy',
};

export const EVENT_TYPE_KEYS: Record<string, string> = {
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
  OathProven: 'event_oath_proven',
  RepeatedNoShowPenalty: 'event_repeated_no_show_penalty',
  CampaignRoomBonus: 'event_campaign_room_bonus',
  CampaignBossBonus: 'event_campaign_boss_bonus',
};

/**
 * One saga line per event, taking the already-signed delta (`%{delta}`) so the sentence
 * carries the number in the wanderer's own tongue. Mirrors `EVENT_TYPE_KEYS` entry for entry.
 */
export const CHRONICLE_KEYS: Record<string, string> = {
  ProfileComplete: 'chronicle_profile_complete',
  DailyLogin: 'chronicle_daily_login',
  FirstMessage: 'chronicle_first_message',
  IcebreakerDone: 'chronicle_icebreaker_done',
  QuizDone: 'chronicle_quiz_done',
  MatchReply: 'chronicle_match_reply',
  DateConfirmed: 'chronicle_date_confirmed',
  VideoCallDone: 'chronicle_video_call_done',
  GhostPenalty: 'chronicle_ghost_penalty',
  ReportPenalty: 'chronicle_report_penalty',
  ShipSparked: 'chronicle_ship_sparked',
  QuestComplete: 'chronicle_quest_complete',
  QuestChest: 'chronicle_quest_chest',
  MilestoneChest: 'chronicle_milestone_chest',
  DuplicateLoot: 'chronicle_duplicate_loot',
  AdminAdjustment: 'chronicle_admin_adjustment',
  OathProven: 'chronicle_oath_proven',
  RepeatedNoShowPenalty: 'chronicle_repeated_no_show_penalty',
  CampaignRoomBonus: 'chronicle_campaign_room_bonus',
  CampaignBossBonus: 'chronicle_campaign_boss_bonus',
};

/** Signed for the sentence: a real minus sign, not a hyphen, so "−15" reads as a loss. */
function signedDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/**
 * Same guard as `tierLabel` in lib/tiers: an event type the engine has added but this map has
 * not caught up with must show its raw identifier, not i18n-js's `[missing "en.X" translation]`.
 * A type with a plain label but no saga line falls back to that label.
 */
function eventLine(eventType: string, delta: number): string {
  const chronicle = CHRONICLE_KEYS[eventType];
  if (chronicle) return tKey(chronicle, eventType, { delta: signedDelta(delta) });
  return tKey(EVENT_TYPE_KEYS[eventType], eventType);
}

interface ChronicleSection {
  key: string;
  createdAt: string;
  data: ScoreEventItem[];
}

/** Local-day key so two instants in the same wall-clock day land in one section — grouping by the
 *  UTC boundary instead would occasionally split "today" in half for users west of Greenwich. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Groups the (already newest-first) feed into one section per run of same-local-day items. A
 * plain `groupBy` would also merge two separated runs of the same calendar day back into one
 * section, which can't happen here since the feed only ever moves backward in time.
 */
function groupByDay(items: ScoreEventItem[]): ChronicleSection[] {
  const sections: ChronicleSection[] = [];
  for (const item of items) {
    const key = localDayKey(item.createdAt);
    const current = sections[sections.length - 1];
    if (current && current.key === key) current.data.push(item);
    else sections.push({ key, createdAt: item.createdAt, data: [item] });
  }
  return sections;
}

/** The chronicle's day heading: a dawn count against `joinedAt`, exactly like `hearth_dawn`, or
 *  the plain date once there's no join date to count from — the dateline this replaced. */
function sectionHeading(createdAt: string, joinedAt: string | undefined): string {
  if (!joinedAt) return formatDate(createdAt);
  return i18n.t('chronicle_dawn', { dawn: ordinalWord(threadDay(createdAt, joinedAt)) });
}

export function ScoreHistoryList({ items, onEndReached, isFetchingNextPage, joinedAt }: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyHint>{i18n.t('no_score_events')}</EmptyHint>
      </View>
    );
  }

  return (
    <SectionList
      sections={groupByDay(items)}
      keyExtractor={(item, index) => `${item.eventType}-${item.createdAt}-${index}`}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      renderSectionHeader={({ section }) => (
        <CardEyebrow style={styles.sectionHeading}>
          {sectionHeading(section.createdAt, joinedAt)}
        </CardEyebrow>
      )}
      ListFooterComponent={isFetchingNextPage ? (
        <View style={styles.footer}>
          <Waiting size={ICON_SIZES.md} />
        </View>
      ) : null}
      renderItem={({ item, index }) => {
        const icon: EventGlyph = EVENT_ICONS[item.eventType] ?? 'star-four-points';
        const sign = item.delta >= 0 ? '+' : '';
        const color = item.delta >= 0 ? METAL.gold : METAL.ember;
        return (
          <Entering index={index}>
            <View style={styles.row}>
              <Icon name={icon} size={ICON_SIZES.md} color={INK.dim} style={styles.icon} />
              <View style={styles.body}>
                <Text style={styles.line}>{eventLine(item.eventType, item.delta)}</Text>
              </View>
              <Text style={[styles.delta, { color }]}>{sign}{item.delta}</Text>
            </View>
          </Entering>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.gutter,
    borderBottomWidth: 1, borderBottomColor: SURFACE.raised,
  },
  icon: { width: 18, textAlign: 'center' },
  body: { flex: 1 },
  line: { fontSize: FONT_SIZES.md, fontFamily: FONTS.body, color: INK.primary },
  sectionHeading: { paddingTop: SPACE.md },
  delta: { fontSize: FONT_SIZES.md, fontFamily: FONTS.bodyBold },
  footer: { alignItems: 'center', paddingVertical: SPACE.lg },
  empty: { alignItems: 'center', padding: SPACE.huge },
});
