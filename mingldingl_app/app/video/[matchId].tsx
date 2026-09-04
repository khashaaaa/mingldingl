import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useVideoCall } from '../../hooks/useVideoCall';
import { useMatches } from '../../hooks/useMatches';
import { VideoControls } from '../../components/video/VideoControls';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { GameButton } from '../../components/ui/GameButton';
import { AlertModal } from '../../components/modals/AlertModal';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { queryKeys } from '../../lib/api/queryKeys';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';
import { toDroppedItem } from '../../lib/tiers';
import { Icon } from '../../components/ui/Icon';

const DEFAULT_RITE_DURATION_MINUTES = 5;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const bumpScore = useOptimisticScoreBump();
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const { token, loading, error, muted, setMuted, cameraOff, setCameraOff } = useVideoCall(matchId);
  const { data: matches } = useMatches();
  const match = matches?.find((m) => m.matchId === matchId);

  const riteActive = !match?.flameRiteCompletedAt;

  const riteDurationMinutes = match?.flameRiteDurationMinutes ?? DEFAULT_RITE_DURATION_MINUTES;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [completeFailed, setCompleteFailed] = useState(false);
  const [callFailed, setCallFailed] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endingRef = useRef(false);
  useEffect(() => {
    if (!riteActive || !token) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(riteDurationMinutes * 60);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(interval);
  }, [riteActive, token, riteDurationMinutes]);

  const handleEnd = useCallback(async () => {
    // Guarded with a ref as well as state: two taps in the same frame would both pass the state check.
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setConfirmEnd(false);
    try {
      const result = await apiClient.video.complete(matchId);

      qc.invalidateQueries({ queryKey: queryKeys.matches });
      qc.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });
      if ((result.awarded ?? 0) > 0) {
        bumpScore(result.awarded ?? 0);

        qc.invalidateQueries({ queryKey: queryKeys.quests });
        qc.invalidateQueries({ queryKey: queryKeys.milestones });
      }
      const drop = toDroppedItem(result.droppedItem);
      if (drop) setPendingDrop(drop);
      router.back();
    } catch {
      setCompleteFailed(true);
    } finally {
      endingRef.current = false;
      setEnding(false);
    }
  }, [matchId, qc, bumpScore, setPendingDrop, router]);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={COLORS.gold} />
    </View>
  );

  if (error || !token) return (
    <View style={[styles.centered, styles.stack]}>
      <Text style={styles.unavailable}>
        {error ?? i18n.t('video_unavailable')}
      </Text>
      <GameButton variant="primary" onPress={() => router.back()}>
        {i18n.t('back')}
      </GameButton>
    </View>
  );

  // A failed connection used to bounce the user straight back to the chat with no explanation —
  // the same gap the Town Square round screen already closes.
  if (callFailed) return (
    <View style={[styles.centered, styles.stack, styles.failPadding]}>
      <Icon name="video-off" size={ICON_SIZES.hero} color={COLORS.emberLight} />
      <Text style={styles.errorTitle}>{i18n.t('video_connect_error_title')}</Text>
      <Text style={styles.errorBody}>{i18n.t('video_connect_error_body')}</Text>
      <GameButton variant="primary" onPress={() => { setCallFailed(false); setAttempt((a) => a + 1); }}>
        {i18n.t('rejoin')}
      </GameButton>
      <GameButton variant="ghost" size="compact" onPress={() => router.back()}>
        {i18n.t('back')}
      </GameButton>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AgoraVideoCall
        key={attempt}
        token={token}
        muted={muted}
        cameraOff={cameraOff}
        onJoined={() => {}}
        onError={() => setCallFailed(true)}
      />
      {riteActive && secondsLeft !== null && (
        <View style={styles.riteFraming} pointerEvents="none">
          <View style={styles.riteTitleRow}>
            <Icon name="fire" size={ICON_SIZES.md} color={COLORS.ember} />
            <Text style={styles.riteFramingTitle}>{i18n.t('rite_title')}</Text>
          </View>
          <Text style={styles.riteFramingCountdown}>{formatCountdown(secondsLeft)}</Text>
        </View>
      )}
      <VideoControls
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        // Ending the rite is not recoverable, so it asks first — as the Town Square round does.
        onEnd={() => setConfirmEnd(true)}
        endDisabled={ending}
      />
      <AlertModal
        visible={confirmEnd}
        tone="warning"
        title={i18n.t('video_end_confirm_title')}
        message={i18n.t('video_end_confirm_body')}
        confirmLabel={i18n.t('video_end_confirm')}
        isConfirming={ending}
        onConfirm={handleEnd}
        onDismiss={() => setConfirmEnd(false)}
      />
      <AlertModal
        visible={completeFailed}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('video_award_failed')}
        onDismiss={() => { setCompleteFailed(false); router.back(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  stack: { gap: SPACE.lg },
  failPadding: { paddingHorizontal: SPACE.huge },
  unavailable: { color: COLORS.text, fontSize: FONT_SIZES.xl, textAlign: 'center', fontFamily: FONTS.body },
  riteFraming: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: SPACE.hair,
  },
  riteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  riteFramingTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.md,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  riteFramingCountdown: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS.text,
  },
  errorTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: COLORS.text, textAlign: 'center' },
  errorBody: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center' },
});
