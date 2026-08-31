import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from 'tamagui';
import { useChat } from '../../hooks/useChat';
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
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { COLORS, FONTS, RADIUS, overlay } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';

const DEFAULT_RITE_DURATION_MINUTES = 5;

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ChatScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId, name, wovenBy } = useLocalSearchParams<{ matchId: string; name?: string; wovenBy?: string }>();
  const { messages, loading, isError, refetch, sendMessage, retryMessage, myId, loadEarlier, hasMore, loadingEarlier } = useChat(matchId);
  const { due: attendanceDue, activityTitle, submit: submitAttendance, isSubmitting: submittingAttendance } = useAttendanceCheck(matchId);
  const { data: matches } = useMatches();
  const match = matches?.find((m) => m.matchId === matchId);
  const riteState: FlameRiteState = {
    matchId,
    proposedByUserId: match?.flameRiteProposedById ?? null,
    proposedAt: match?.flameRiteProposedAt ?? null,
    acceptedAt: match?.flameRiteAcceptedAt ?? null,
    completedAt: match?.flameRiteCompletedAt ?? null,
    durationMinutes: match?.flameRiteDurationMinutes ?? DEFAULT_RITE_DURATION_MINUTES,
  };
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [ghosted, setGhosted] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionFailedAlert, setActionFailedAlert] = useState(false);

  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

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
    apiClient.matches.ghostCheck(matchId)
      .then((res) => {
        if (res.status === 'Ghosted') setGhosted(true);
      })
      .catch(() => {});
  }, [matchId]);

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <ScreenHeader
          title={name || i18n.t('chat_title')}
          right={
            <>
              <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.unmatchBtn} accessibilityLabel={i18n.t('chat_options_title')}>
                <Icon name="dots-vertical" size={20} color={COLORS.textDim} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/video/${matchId}`)} style={styles.videoBtn} accessibilityLabel={i18n.t('start_video_call')}>
                <Icon name="video" size={20} color={COLORS.gold} />
              </TouchableOpacity>
            </>
          }
        />
        {!!wovenBy && (
          <Text style={styles.wovenByBanner}>{i18n.t('woven_by', { name: wovenBy })}</Text>
        )}
        {match && <RevealStrip otherUser={match.otherUser} messageCount={match.messageCount} />}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}

        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Math.max(0, headerHeight - insets.bottom)}
      >
        <QuestBanner icon="target" title={i18n.t('break_ice')}
          onPress={() => router.push(`/icebreaker/${matchId}`)} />
        {match?.icebreakerComplete && (
          <FlameRiteCard matchId={matchId} state={riteState} currentUserId={myId ?? ''} />
        )}
        <QuestBanner icon="brain" title={i18n.t('trial_compat')}
          onPress={() => router.push(`/quiz/${matchId}`)} />
        <QuestBanner icon="map-marker" title={i18n.t('plan_encounter')}
          onPress={() => router.push(`/activities/${matchId}`)} />
        {attendanceDue && (
          <QuestBanner icon="calendar-check" title={i18n.t('attendance_check_title')}
            onPress={() => setAttendanceModalVisible(true)} />
        )}

        {loading ? (
          <View style={styles.spinnerWrap}>
            <Spinner color="$gold" />
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
            onContentSizeChange={() => { if (!loadingEarlier) flatListRef.current?.scrollToEnd({ animated: false }); }}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={hasMore ? (
              <TouchableOpacity style={styles.loadEarlierBtn} onPress={() => loadEarlier()} disabled={loadingEarlier} accessibilityRole="button">
                {loadingEarlier ? <Spinner color="$gold" size="small" /> : (
                  <>
                    <Icon name="chevron-double-up" size={14} color={COLORS.gold} />
                    <Text style={styles.loadEarlierText}>{i18n.t('load_earlier')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
            renderItem={({ item }) => (
              <MessageBubble message={item} myId={myId ?? ''} onRetry={retryMessage} />
            )}
          />
        )}
        <MessageInput onSend={(t) => sendMessage(t)} />
      </KeyboardAvoidingView>
      <AlertModal
        visible={ghosted}
        tone="warning"
        title={i18n.t('match_quiet_title')}
        message={i18n.t('match_quiet_body')}
        onDismiss={() => router.back()}
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
      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>{i18n.t('chat_options_title')}</Text>
            <GameButton variant="ghost" icon="heart-broken" onPress={() => { setOptionsVisible(false); setConfirmUnmatch(true); }}>
              {i18n.t('unmatch')}
            </GameButton>
            <GameButton variant="danger" icon="account-cancel" onPress={() => { setOptionsVisible(false); setConfirmBlock(true); }}>
              {i18n.t('block_user')}
            </GameButton>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboardAvoider: {
    flex: 1,
  },
  unmatchBtn: {
    padding: 12,
  },
  videoBtn: {
    padding: 12,
  },
  videoIcon: {
    fontSize: 20,
  },
  wovenByBanner: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.gold,
    textAlign: 'center',
    paddingVertical: 4,
  },
  spinnerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadErrorText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textDim,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  messageList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  loadEarlierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  loadEarlierText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
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
    borderColor: COLORS.bronze,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    padding: 16,
    gap: 10,
  },
  optionsTitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.textDim,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
});
