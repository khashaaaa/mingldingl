import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from 'tamagui';
import { useChat } from '../../hooks/useChat';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import { QuestBanner } from '../../components/quest/QuestBanner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { COLORS, FONTS, RADIUS, overlay } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ChatScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { matchId, name, wovenBy } = useLocalSearchParams<{ matchId: string; name?: string; wovenBy?: string }>();
  const { messages, loading, sendMessage, retryMessage, myId } = useChat(matchId);
  const [ghosted, setGhosted] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionFailedAlert, setActionFailedAlert] = useState(false);
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
    useAuthStore.getState().setActiveChatMatchId(matchId);
    return () => useAuthStore.getState().setActiveChatMatchId(null);
  }, [matchId]);

  useEffect(() => {
    // On-demand ghost check: catches a stale match the moment it's opened,
    // rather than waiting for the hourly background sweep.
    apiClient.matches.ghostCheck(matchId)
      .then((res) => {
        if (res.status === 'Ghosted') setGhosted(true);
      })
      .catch(() => {});
  }, [matchId]);

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
      <ScreenHeader
        title={name || i18n.t('chat_title')}
        right={
          <>
            <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.unmatchBtn} accessibilityLabel={i18n.t('chat_options_title')}>
              <Icon name="dots-vertical" size={20} color={COLORS.textDim} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/video/${matchId}`)} style={styles.videoBtn} accessibilityLabel={i18n.t('start_video_call')}>
              <Text style={styles.videoIcon}>📹</Text>
            </TouchableOpacity>
          </>
        }
      />
      {!!wovenBy && (
        <Text style={styles.wovenByBanner}>{i18n.t('woven_by', { name: wovenBy })}</Text>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        // 'undefined' on Android meant this view did nothing when the
        // keyboard opened — the message input/send button stayed put and
        // the keyboard just covered them. 'height' shrinks the view by the
        // keyboard's height instead, which is the standard Android
        // counterpart to iOS's 'padding'.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <QuestBanner icon="🎯" title={i18n.t('break_ice')}
          onPress={() => router.push(`/icebreaker/${matchId}`)} />
        <QuestBanner icon="🧠" title={i18n.t('trial_compat')}
          onPress={() => router.push(`/quiz/${matchId}`)} />
        <QuestBanner icon="📍" title={i18n.t('plan_encounter')}
          onPress={() => router.push(`/activities/${matchId}`)} />

        {loading ? (
          <View style={styles.spinnerWrap}>
            <Spinner color="$gold" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
  },
  messageList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
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
