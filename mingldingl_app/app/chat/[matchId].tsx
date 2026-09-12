import { useState, useEffect, useRef } from 'react';
import { Tap } from '../../components/ui/Tap';
import { View, Text, FlatList, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAndroidKeyboardHeight } from '../../hooks/useAndroidKeyboardHeight';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCampaign } from '../../hooks/useCampaign';
import { useChat } from '../../hooks/useChat';
import { useMatchStatus } from '../../hooks/useMatchStatus';
import { useAttendanceCheck } from '../../hooks/useAttendanceCheck';
import { useMatches } from '../../hooks/useMatches';
import { AlertModal } from '../../components/modals/AlertModal';
import { AppModal } from '../../components/modals/AppModal';
import { AttendanceCheckModal } from '../../components/modals/AttendanceCheckModal';
import { ReportUserSheet } from '../../components/modals/ReportUserSheet';
import FlameRiteCard, { type FlameRiteState } from '../../components/FlameRiteCard';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import { SealDots, SEAL_COUNT, sealsBroken } from '../../components/chat/SealDots';
import { SealsSheet } from '../../components/chat/SealsSheet';
import { SealedLetter } from '../../components/chat/SealedLetter';
import { Unsealing } from '../../components/chat/Unsealing';
import { QuestBanner } from '../../components/quest/QuestBanner';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Waiting } from '../../components/ui/Waiting';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, RADIUS, SCRIM, SPACE, SURFACE, TRACKING, overlay } from '../../lib/theme';
import { FieldError, StateBlock } from '../../components/ui/StateBlock';
import { useAuthStore } from '../../store/authStore';
import { useActivityGate, useRevealLadder } from '../../hooks/useRevealThresholds';
import { messagesUntilActivities, nextRevealThreshold } from '../../lib/reveal';
import { useUnsealing } from '../../hooks/useUnsealing';
import { useSealedLetter } from '../../hooks/useSealedLetter';

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
  const [sealsVisible, setSealsVisible] = useState(false);
  const activityGate = useActivityGate();
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionFailedAlert, setActionFailedAlert] = useState(false);

  // Only things the other side has put in your court — an invitation you have not answered.
  const ritePendingMyAnswer =
    !!riteState.proposedByUserId && riteState.proposedByUserId !== myId
    && !riteState.acceptedAt && !riteState.completedAt;
  const waitingOnYou = (attendanceDue ? 1 : 0) + (ritePendingMyAnswer ? 1 : 0);
  // match.messageCount is the engine's mutual count, which is what the gate itself reads.
  const encounterLockedBy = messagesUntilActivities(match?.messageCount ?? 0, activityGate);

  // The reveal ceremony. Everything it shows is derived from the match rather than held in state,
  // so a reveal that lands while the modal is already open updates it instead of queueing.
  const revealLadder = useRevealLadder();
  const { unsealed, dismiss: dismissUnsealing } = useUnsealing(matchId, match?.revealLevel);
  // The other side's first word arrives as a sealed letter, once, until you break the wax.
  const { sealedMessageId, unseal } = useSealedLetter(matchId, messages, myId, hasMore);
  const revealedPhotos = match
    ? [match.otherUser.firstPhoto, match.otherUser.secondPhoto, match.otherUser.thirdPhoto].filter(Boolean)
    : [];
  // Reveals arrive in order, so the last one present is the one that just broke its seal.
  const unsealedPhoto = revealedPhotos[revealedPhotos.length - 1] ?? null;
  const unsealedNextAt = nextRevealThreshold(match?.messageCount ?? 0, revealLadder);
  const broken = sealsBroken(match?.revealLevel);
  // Only rungs 2-4 carry a seal-breaking ceremony; the floor every match starts on (1) has none.
  const unsealedLevel = Math.min(Math.max(match?.revealLevel ?? 2, 2), 4);
  // The sheet draws this line lowercase, as a fragment under its own eyebrow — but the ceremony
  // reads it as the second sentence of a two-sentence subline, so here it needs the capital and
  // full stop that make it one. Only the ceremony's copy changes; the keys stay as written.
  const unsealedTail = unsealedNextAt !== null
    ? i18n.t('seals_next_at', { count: unsealedNextAt })
    : i18n.t('seals_left_0');
  const unsealedTailSentence = `${unsealedTail.charAt(0).toUpperCase()}${unsealedTail.slice(1)}.`;

  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidKeyboardHeight();
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

  // `name` is a route param frozen when the quest-log row was tapped, so a match that crossed the
  // level-2 reveal threshold mid-conversation kept a "??? • Mystery" header while the reveal strip
  // right below it already read "2 of 3 photos". Derive it from the live match instead, and keep
  // the param only as the first-paint value while `useMatches` is still in flight.
  const revealedName = match
    ? match.otherUser.isDeleted
      ? i18n.t('deleted_user')
      : match.revealLevel >= 2
        ? (match.otherUser.displayName ?? i18n.t('unknown_name'))
        : i18n.t('mystery_match_name')
    : null;

  return (
    <View style={styles.container}>
      <View>
        <HeaderBar
          title={revealedName || name || i18n.t('chat_title')}
          right={
            <>
              <Tap onPress={() => setOptionsVisible(true)} style={styles.unmatchBtn} accessibilityLabel={i18n.t('chat_options_title')}>
                <Icon name="dots-vertical" size={ICON_SIZES.lg} color={INK.dim} />
              </Tap>
              {!endedReason && (
                <Tap onPress={() => router.push(`/video/${matchId}`)} style={styles.videoBtn} accessibilityLabel={i18n.t('start_video_call')}>
                  <Icon name="video" size={ICON_SIZES.lg} color={ACCENT.base} />
                </Tap>
              )}
            </>
          }
        >
          {match && (
            <Tap
              onPress={() => setSealsVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('seals_title')}
              style={styles.sealsRow}
              testID="seals-toggle"
            >
              <SealDots broken={broken} />
              <Text style={styles.sealsLeft}>{i18n.t(`seals_left_${SEAL_COUNT - broken}`)}</Text>
            </Tap>
          )}
        </HeaderBar>
        {!!wovenBy && (
          <Text style={styles.wovenByBanner}>{i18n.t('woven_by', { name: wovenBy })}</Text>
        )}
        {match && (
          <Unsealing
            visible={unsealed}
            onDismiss={dismissUnsealing}
            photoUri={unsealedPhoto}
            headline={i18n.t(`seal_breaks_${unsealedLevel}`)}
            subline={`${i18n.t(`seal_broke_${unsealedLevel}`)} ${unsealedTailSentence}`}
          />
        )}
      </View>

      <KeyboardAvoidingView
        style={[styles.keyboardAvoider, Platform.OS === 'android' && {
          // The event's height stops at the navigation bar the screen draws under, so the bar
          // is added back while the keyboard is up.
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + insets.bottom : 0,
        }]}
        // Android pads by the measured keyboard instead (see useAndroidKeyboardHeight): `height`
        // left the composer ~80dp above the bottom edge after the keyboard closed, `padding` did
        // the same by a different route, and with no behaviour at all the composer vanished
        // behind the keyboard, because edge-to-edge does not resize the window. Seen on the A51.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // KeyboardAvoidingView measures its own frame relative to its parent, so the offset is the
        // screen-space origin of that parent — the root SafeAreaView's top edge, not the header.
        keyboardVerticalOffset={insets.top}
      >
        {/* One door, not five. Stacking every per-match activity above the thread pushed the
            conversation itself off the first screen; they all live in the sheet now, and this row
            says when one of them is actually waiting on you. Hidden entirely on a severed bond,
            where every one of them is a dead end. */}
        {!endedReason && (
          <Tap
            onPress={() => setActivitiesVisible(true)}
           
            accessibilityRole="button"
            testID="chat-activities"
          >
            <View style={styles.activitiesRow}>
              <Icon name="compass-rose" size={ICON_SIZES.md} color={ACCENT.base} />
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
          </Tap>
        )}

        {loading ? (
          <View style={styles.spinnerWrap}>
            <Waiting />
          </View>
        ) : isError ? (
          <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('chat_load_error')}>
            <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </StateBlock>
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
            // A brand-new match has nothing to scroll through yet — without this the thread was
            // just the reveal strip and activities row over a blank area, with no cue that
            // sending the first message is the way to begin.
            ListEmptyComponent={!hasMore ? (
              <StateBlock
                testID="chat-empty"
                style={styles.emptyWrap}
                icon="message-text-outline"
                title={i18n.t('chat_empty_title')}
                body={i18n.t('chat_empty_sub')}
              />
            ) : null}
            ListHeaderComponent={hasMore ? (
              <>
                <Tap style={styles.loadEarlierBtn} onPress={() => loadEarlier()} disabled={loadingEarlier} accessibilityRole="button">
                  {loadingEarlier ? <Waiting size={ICON_SIZES.md} /> : (
                    <>
                      <Icon name="chevron-double-up" size={ICON_SIZES.sm} color={ACCENT.base} />
                      <Text style={styles.loadEarlierText}>{i18n.t('load_earlier')}</Text>
                    </>
                  )}
                </Tap>
                {earlierError && <FieldError style={styles.loadErrorText}>{i18n.t('load_earlier_failed')}</FieldError>}
              </>
            ) : null}
            renderItem={({ item }) => (
              item.id === sealedMessageId
                // The match carries no tier for the other side, so the wax is gold.
                ? <SealedLetter onOpen={unseal} sealColor={METAL.gold} />
                : <MessageBubble message={item} myId={myId ?? ''} onRetry={retryMessage} />
            )}
          />
        )}
        {endedReason ? (
          <View style={styles.endedNotice}>
            <Icon name="link-variant-off" size={ICON_SIZES.sm} color={INK.dim} />
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
      <AppModal visible={activitiesVisible} transparent animationType="fade" onRequestClose={() => setActivitiesVisible(false)}>
        <Tap style={styles.optionsOverlay} feedback="none" onPress={() => setActivitiesVisible(false)}>
          <Tap
            feedback="none"
            onPress={() => {}}
            style={[styles.optionsSheet, { paddingBottom: SPACE.lg + insets.bottom }]}
          >
            <Text style={styles.optionsTitle}>{i18n.t('match_activities')}</Text>
            <ScrollView style={styles.activitiesScroll} contentContainerStyle={styles.activitiesScrollContent}>
              {campaign && (
                <QuestBanner icon="map" tint={ACCENT.bright} medallion="knot"
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
              {/* The gate is the engine's (activity.suggestions.messages, served with the reveal
                  ladder). Offering the door unconditionally sent people to a screen that could
                  only say "keep chatting" with no idea how much more was needed. */}
              {encounterLockedBy > 0 ? (
                <QuestBanner icon="lock" disabled
                  title={i18n.t('encounter_locked', { count: encounterLockedBy })} />
              ) : (
                <QuestBanner icon="map-marker" title={i18n.t('plan_encounter')}
                  onPress={() => { setActivitiesVisible(false); router.push(`/activities/${matchId}`); }} />
              )}
              {attendanceDue && (
                <QuestBanner icon="calendar-check" title={i18n.t('attendance_check_title')}
                  onPress={() => { setActivitiesVisible(false); setAttendanceModalVisible(true); }} />
              )}
            </ScrollView>
          </Tap>
        </Tap>
      </AppModal>
      <AppModal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <Tap style={styles.optionsOverlay} feedback="none" onPress={() => setOptionsVisible(false)}>
          {/* Swallows taps so pressing the sheet's own padding or title does not dismiss it. */}
          <Tap
            feedback="none"
            onPress={() => {}}
            style={[styles.optionsSheet, { paddingBottom: SPACE.lg + insets.bottom }]}
          >
            <Text style={styles.optionsTitle}>{i18n.t('chat_options_title')}</Text>
            <GameButton variant="ink" icon="heart-broken" onPress={() => { setOptionsVisible(false); setConfirmUnmatch(true); }}>
              {i18n.t('unmatch')}
            </GameButton>
            <GameButton variant="danger" icon="account-cancel" onPress={() => { setOptionsVisible(false); setConfirmBlock(true); }}>
              {i18n.t('block_user')}
            </GameButton>
            <GameButton variant="danger" icon="flag" onPress={() => { setOptionsVisible(false); setReportVisible(true); }}>
              {i18n.t('report_user')}
            </GameButton>
          </Tap>
        </Tap>
      </AppModal>
      {match && (
        <ReportUserSheet
          visible={reportVisible}
          reportedUserId={match.otherUserId}
          matchId={matchId}
          onClose={() => setReportVisible(false)}
          // The engine blocks them and ends the thread in the same write, so the conversation this
          // screen is showing is already over by the time this fires.
          onReported={() => router.back()}
        />
      )}
      {match && (
        <SealsSheet
          visible={sealsVisible}
          onClose={() => setSealsVisible(false)}
          otherUser={match.otherUser}
          messageCount={match.messageCount}
          revealLevel={match.revealLevel}
        />
      )}
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
  sealsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  sealsLeft: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.sm,
    color: INK.dim,
    letterSpacing: TRACKING.wide,
  },
  wovenByBanner: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    color: ACCENT.base,
    textAlign: 'center',
    paddingVertical: SPACE.xs,
  },
  spinnerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
  },
  loadErrorText: { textAlign: 'center', paddingHorizontal: SPACE.huge },
  messageList: {
    paddingHorizontal: SPACE.gutter,
    paddingVertical: SPACE.lg,
    flexGrow: 1,
  },
  emptyWrap: { flex: 1, paddingHorizontal: SPACE.huge },
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
    borderColor: METAL.brass,
    backgroundColor: SURFACE.panel,
  },
  activitiesLabel: { flex: 1 },
  activitiesTitle: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: ACCENT.base },
  activitiesSub: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim },
  activitiesBadge: {
    minWidth: 20,
    paddingHorizontal: SPACE.xs,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    backgroundColor: METAL.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitiesBadgeText: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.sm, color: INK.primary },
  activitiesChevron: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: ACCENT.base },
  activitiesScroll: { maxHeight: 420 },
  activitiesScrollContent: { paddingBottom: SPACE.sm },
  endedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    backgroundColor: SURFACE.panel,
    borderTopColor: LINE.edge,
    borderTopWidth: 1,
  },
  endedNoticeText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
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
    borderColor: METAL.brass,
    backgroundColor: SURFACE.panel,
  },
  loadEarlierText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sm,
    color: ACCENT.base,
    letterSpacing: TRACKING.label,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: overlay(SCRIM.sheet),
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: SURFACE.panel,
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
    color: INK.dim,
    letterSpacing: TRACKING.eyebrow,
    textAlign: 'center',
    marginBottom: SPACE.xs,
    textTransform: 'uppercase',
  },
});
