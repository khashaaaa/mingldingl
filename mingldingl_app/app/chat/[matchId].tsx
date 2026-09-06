import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCampaign } from '../../hooks/useCampaign';
import { useChat } from '../../hooks/useChat';
import { useMatchStatus } from '../../hooks/useMatchStatus';
import { useAttendanceCheck } from '../../hooks/useAttendanceCheck';
import { useMatches } from '../../hooks/useMatches';
import { AlertModal } from '../../components/modals/AlertModal';
import { AttendanceCheckModal } from '../../components/modals/AttendanceCheckModal';
import FlameRiteCard, { type FlameRiteState } from '../../components/FlameRiteCard';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import { RevealStrip } from '../../components/chat/RevealStrip';
import { QuestBanner } from '../../components/quest/QuestBanner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, RADIUS, SPACE, overlay } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';

const DEFAULT_RITE_DURATION_MINUTES = 5;

/** How close to the newest message still counts as "following the conversation", in px. */
const NEAR_BOTTOM_SLOP = 80;


export default function ChatScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId, name, wovenBy } = useLocalSearchParams<{ matchId: string; name?: string; wovenBy?: string }>();
  const {
    messages, loading, isError, refetch, sendMessage, retryMessage, myId,
    loadEarlier, hasMore, loadingEarlier, earlierError, justLoadedEarlier, acknowledgeEarlierLoaded,
  } = useChat(matchId);
  const {
    due: attendanceDue, activityTitle, submit: submitAttendance,
    isSubmitting: submittingAttendance, submitFailed, clearSubmitFailed,
  } = useAttendanceCheck(matchId);
  const { data: matches } = useMatches();
  const match = matches?.find((m) => m.matchId === matchId);
  const { campaign } = useCampaign(matchId);
  const riteState: FlameRiteState = {
    matchId,
    proposedByUserId: match?.flameRiteProposedById ?? null,
    proposedAt: match?.flameRiteProposedAt ?? null,
    acceptedAt: match?.flameRiteAcceptedAt ?? null,
    completedAt: match?.flameRiteCompletedAt ?? null,
    durationMinutes: match?.flameRiteDurationMinutes ?? DEFAULT_RITE_DURATION_MINUTES,
  };
  const { endedReason } = useMatchStatus(matchId);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [endedAcknowledged, setEndedAcknowledged] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [activitiesVisible, setActivitiesVisible] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionFailedAlert, setActionFailedAlert] = useState(false);

  // Only things the other side has put in your court — an invitation you have not answered.
  const ritePendingMyAnswer =
    !!riteState.proposedByUserId && riteState.proposedByUserId !== myId
    && !riteState.acceptedAt && !riteState.completedAt;
  const waitingOnYou = (attendanceDue ? 1 : 0) + (ritePendingMyAnswer ? 1 : 0);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  // Auto-scrolling on every content change threw you to the bottom mid-read whenever the other side
  // typed. Only follow the tail when the reader is already sitting on it.
  const nearBottomRef = useRef(true);

  /**
   * Message rows are variable height, so a single scrollToEnd runs against a content height that
   * is still being measured and lands a few bubbles short — which then latches nearBottomRef
   * false, and the thread never follows a new message again. The second pass runs once the rows
   * have settled.
   */
  function scrollToEndSoon() {
    flatListRef.current?.scrollToEnd({ animated: false });
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }));
  }

  async function handleUnmatch() {
    setUnmatching(true);
    try {
      await apiClient.matches.unmatch(matchId);
      qc.invalidateQueries({ queryKey: queryKeys.matches });
      router.back();
    } catch {
      setUnmatching(false);
      setConfirmUnmatch(false);
      setActionFailedAlert(true);
    }
  }

  async function handleBlock() {
    setBlocking(true);
    try {
      await apiClient.matches.block(matchId);
      qc.invalidateQueries({ queryKey: queryKeys.matches });
      router.back();
    } catch {
      setBlocking(false);
      setConfirmBlock(false);
      setActionFailedAlert(true);
    }
  }

  useEffect(() => {
    useAuthStore.getState().pushActiveChat(matchId);
    return () => useAuthStore.getState().popActiveChat(matchId);
  }, [matchId]);

  useEffect(() => {
    setEndedAcknowledged(false);
  }, [matchId]);

  return (
    <View style={styles.container}>
      <View>
        <ScreenHeader
          title={name || i18n.t('chat_title')}
          right={
            <>
              <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.unmatchBtn} accessibilityLabel={i18n.t('chat_options_title')}>
                <Icon name="dots-vertical" size={ICON_SIZES.lg} color={COLORS.textDim} />
              </TouchableOpacity>
              {!endedReason && (
                <TouchableOpacity onPress={() => router.push(`/video/${matchId}`)} style={styles.videoBtn} accessibilityLabel={i18n.t('start_video_call')}>
                  <Icon name="video" size={ICON_SIZES.lg} color={COLORS.gold} />
                </TouchableOpacity>
              )}
            </>
          }
        />
        {!!wovenBy && (
          <Text style={styles.wovenByBanner}>{i18n.t('woven_by', { name: wovenBy })}</Text>
        )}
        {match && (
          <RevealStrip
            otherUser={match.otherUser}
            messageCount={match.messageCount}
            revealLevel={match.revealLevel}
            defaultExpanded={false}
          />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}

        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // KeyboardAvoidingView measures its own frame relative to its parent, so the offset is the
        // screen-space origin of that parent — the root SafeAreaView's top edge, not the header.
        keyboardVerticalOffset={insets.top}
      >
        {/* One door, not five. Stacking every per-match activity above the thread pushed the
            conversation itself off the first screen; they all live in the sheet now, and this row
            says when one of them is actually waiting on you. Hidden entirely on a severed bond,
            where every one of them is a dead end. */}
        {!endedReason && (
          <TouchableOpacity
            onPress={() => setActivitiesVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            testID="chat-activities"
          >
            <View style={styles.activitiesRow}>
              <Icon name="compass-rose" size={ICON_SIZES.md} color={COLORS.gold} />
              <View style={styles.activitiesLabel}>
                <Text style={styles.activitiesTitle} numberOfLines={1}>{i18n.t('match_activities')}</Text>
                {waitingOnYou > 0 && (
                  <Text style={styles.activitiesSub} numberOfLines={1}>
                    {i18n.t('match_activities_waiting', { count: waitingOnYou })}
                  </Text>
                )}
              </View>
              {waitingOnYou > 0 && (
                <View style={styles.activitiesBadge}>
                  <Text style={styles.activitiesBadgeText}>{waitingOnYou}</Text>
                </View>
              )}
              <Text style={styles.activitiesChevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : isError ? (
          <View style={styles.spinnerWrap}>
            <Text style={styles.loadErrorText}>{i18n.t('chat_load_error')}</Text>
            <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              nearBottomRef.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height <= NEAR_BOTTOM_SLOP;
            }}
            scrollEventThrottle={16}
            // Prepending a page of history otherwise leaves the scroll offset where it was, so the
            // 50 new rows above it shove the message you were reading off-screen.
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            // Prepending a page of history otherwise leaves the scroll offset where it was, so the
            // 50 new rows above it shove the message you were reading off-screen.
            onContentSizeChange={() => {
              if (loadingEarlier || justLoadedEarlier) { acknowledgeEarlierLoaded(); return; }
              if (!nearBottomRef.current) return;
              scrollToEndSoon();
            }}
            onLayout={scrollToEndSoon}
            ListHeaderComponent={hasMore ? (
              <>
                <TouchableOpacity style={styles.loadEarlierBtn} onPress={() => loadEarlier()} disabled={loadingEarlier} accessibilityRole="button">
                  {loadingEarlier ? <ActivityIndicator color={COLORS.gold} size="small" /> : (
                    <>
                      <Icon name="chevron-double-up" size={ICON_SIZES.sm} color={COLORS.gold} />
                      <Text style={styles.loadEarlierText}>{i18n.t('load_earlier')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {earlierError && <Text style={styles.loadErrorText}>{i18n.t('load_earlier_failed')}</Text>}
              </>
            ) : null}
            renderItem={({ item }) => (
              <MessageBubble message={item} myId={myId ?? ''} onRetry={retryMessage} />
            )}
          />
        )}
        {endedReason ? (
          <View style={styles.endedNotice}>
            <Icon name="link-variant-off" size={ICON_SIZES.sm} color={COLORS.textDim} />
            <Text style={styles.endedNoticeText}>
              {endedReason === 'ghosted' ? i18n.t('match_quiet_body') : i18n.t('match_ended_notice')}
            </Text>
          </View>
        ) : (
          // Sending is an explicit request to be at the bottom: the optimistic row is appended
          // below whatever you had scrolled to, and without this it lands off-screen.
          <MessageInput
            onSend={(t) => {
              nearBottomRef.current = true;
              sendMessage(t);
            }}
          />
        )}
      </KeyboardAvoidingView>
      <AlertModal
        visible={!!endedReason && !endedAcknowledged}
        tone="warning"
        title={endedReason === 'ghosted' ? i18n.t('match_quiet_title') : i18n.t('match_ended_title')}
        message={endedReason === 'ghosted' ? i18n.t('match_quiet_body') : i18n.t('match_ended_body')}
        onDismiss={() => setEndedAcknowledged(true)}
      />
      <AlertModal
        visible={confirmUnmatch}
        tone="warning"
        title={i18n.t('unmatch_confirm_title')}
        message={i18n.t('unmatch_confirm_body')}
        confirmLabel={i18n.t('unmatch')}
        isConfirming={unmatching}
        onConfirm={handleUnmatch}
        onDismiss={() => setConfirmUnmatch(false)}
      />
      <AlertModal
        visible={confirmBlock}
        tone="warning"
        title={i18n.t('block_confirm_title')}
        message={i18n.t('block_confirm_body')}
        confirmLabel={i18n.t('block_user')}
        isConfirming={blocking}
        onConfirm={handleBlock}
        onDismiss={() => setConfirmBlock(false)}
      />
      <AlertModal
        visible={actionFailedAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setActionFailedAlert(false)}
      />
      <AttendanceCheckModal
        visible={attendanceModalVisible}
        activityTitle={activityTitle}
        isSubmitting={submittingAttendance}
        onYes={() => { submitAttendance(true); setAttendanceModalVisible(false); }}
        onNo={() => { submitAttendance(false); setAttendanceModalVisible(false); }}
        onDismiss={() => setAttendanceModalVisible(false)}
      />
      <AlertModal
        visible={submitFailed}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('attendance_submit_failed')}
        onDismiss={() => { clearSubmitFailed(); setAttendanceModalVisible(true); }}
      />
      <Modal visible={activitiesVisible} transparent animationType="fade" onRequestClose={() => setActivitiesVisible(false)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setActivitiesVisible(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[styles.optionsSheet, { paddingBottom: SPACE.lg + insets.bottom }]}
          >
            <Text style={styles.optionsTitle}>{i18n.t('match_activities')}</Text>
            <ScrollView style={styles.activitiesScroll} contentContainerStyle={styles.activitiesScrollContent}>
              {campaign && (
                <QuestBanner icon="map" tint={COLORS.goldBright} medallion="knot"
                  title={i18n.t('campaign_banner', { cleared: campaign.clearedCount, total: campaign.rooms.length })}
                  onPress={() => { setActivitiesVisible(false); router.push(`/campaign/${matchId}`); }} />
              )}
              <QuestBanner icon="target" title={i18n.t('break_ice')}
                onPress={() => { setActivitiesVisible(false); router.push(`/icebreaker/${matchId}`); }} />
              {match?.icebreakerComplete && (match?.videoEnabled ?? true) && (
                <FlameRiteCard matchId={matchId} state={riteState} currentUserId={myId ?? ''} />
              )}
              <QuestBanner icon="brain" title={i18n.t('trial_compat')}
                onPress={() => { setActivitiesVisible(false); router.push(`/quiz/${matchId}`); }} />
              <QuestBanner icon="map-marker" title={i18n.t('plan_encounter')}
                onPress={() => { setActivitiesVisible(false); router.push(`/activities/${matchId}`); }} />
              {attendanceDue && (
                <QuestBanner icon="calendar-check" title={i18n.t('attendance_check_title')}
                  onPress={() => { setActivitiesVisible(false); setAttendanceModalVisible(true); }} />
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          {/* Swallows taps so pressing the sheet's own padding or title does not dismiss it. */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[styles.optionsSheet, { paddingBottom: SPACE.lg + insets.bottom }]}
          >
            <Text style={styles.optionsTitle}>{i18n.t('chat_options_title')}</Text>
            <GameButton variant="ghost" icon="heart-broken" onPress={() => { setOptionsVisible(false); setConfirmUnmatch(true); }}>
              {i18n.t('unmatch')}
            </GameButton>
            <GameButton variant="danger" icon="account-cancel" onPress={() => { setOptionsVisible(false); setConfirmBlock(true); }}>
              {i18n.t('block_user')}
            </GameButton>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardAvoider: {
    flex: 1,
  },
  unmatchBtn: {
    padding: SPACE.md,
  },
  videoBtn: {
    padding: SPACE.md,
  },
  wovenByBanner: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold,
    textAlign: 'center',
    paddingVertical: SPACE.xs,
  },
  spinnerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
  },
  loadErrorText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textDim,
    textAlign: 'center',
    paddingHorizontal: SPACE.huge,
  },
  messageList: {
    paddingHorizontal: SPACE.gutter,
    paddingVertical: SPACE.lg,
    flexGrow: 1,
  },
  activitiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 48,
    marginHorizontal: SPACE.md,
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  activitiesLabel: { flex: 1 },
  activitiesTitle: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
  activitiesSub: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim },
  activitiesBadge: {
    minWidth: 20,
    paddingHorizontal: SPACE.xs,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitiesBadgeText: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.sm, color: COLORS.text },
  activitiesChevron: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: COLORS.gold },
  activitiesScroll: { maxHeight: 420 },
  activitiesScrollContent: { paddingBottom: SPACE.sm },
  endedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    backgroundColor: COLORS.panel,
    borderTopColor: LINE.edge,
    borderTopWidth: 1,
  },
  endedNoticeText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.md,
    color: COLORS.textDim,
    flexShrink: 1,
  },
  loadEarlierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    alignSelf: 'center',
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  loadEarlierText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: overlay(0.6),
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: COLORS.panel,
    borderTopWidth: 1,
    borderColor: LINE.edge,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  optionsTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textDim,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: SPACE.xs,
    textTransform: 'uppercase',
  },
});
