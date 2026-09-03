import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { VideoControls } from '../../components/video/VideoControls';
import { RoundPrompt } from '../../components/townsquare/RoundPrompt';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { useTownSquareRound } from '../../hooks/useTownSquareRound';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';

export default function TownSquareRoundScreen() {
  useLocaleStore((s) => s.locale);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { round, isLoading, error, markJoined, submitResponse, hasResponded, matchId, isResponding, respondError, clearRespondError } =
    useTownSquareRound(sessionId);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [callFailed, setCallFailed] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function leave() {
    router.replace('/(tabs)/townsquare' as any);
  }

  // #17: an error used to bounce the user out silently; now they are told before leaving.
  if (error) {
    return (
      <AlertModal
        visible
        tone="warning"
        title={i18n.t('round_left_title')}
        message={i18n.t('round_left_body')}
        onDismiss={leave}
      />
    );
  }

  // #16: loading used to render a bare black screen, indistinguishable from a hard failure.
  if (isLoading || !round) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.status}>{i18n.t('round_connecting')}</Text>
      </View>
    );
  }

  const secondsLeft = Math.max(0, Math.round((new Date(round.roundEndsAt).getTime() - now) / 1000));

  return (
    <View style={styles.screen}>
      {/* #15: a failed connection used to leave a blank screen with no way forward. */}
      {callFailed ? (
        <View style={[styles.screen, styles.center]}>
          <Icon name="video-off" size={44} color={COLORS.emberLight} />
          <Text style={styles.errorTitle}>{i18n.t('round_connect_error_title')}</Text>
          <Text style={styles.status}>{i18n.t('round_connect_error_body')}</Text>
          <GameButton
            variant="primary"
            onPress={() => { setCallFailed(false); setAttempt((a) => a + 1); }}
          >
            {i18n.t('rejoin')}
          </GameButton>
          <GameButton variant="ghost" size="compact" onPress={leave}>
            {i18n.t('round_leave_confirm')}
          </GameButton>
        </View>
      ) : (
        <AgoraVideoCall
          key={attempt}
          token={{ token: round.videoToken, channelName: round.channelName, appId: round.appId }}
          muted={muted}
          cameraOff={cameraOff}
          onJoined={() => markJoined(round.pairingId)}
          onError={() => setCallFailed(true)}
        />
      )}

      <RoundPrompt
        icebreakerText={round.icebreakerText}
        roundNumber={round.roundNumber}
        secondsLeft={secondsLeft}
        hasResponded={hasResponded}
        matchId={matchId}
        isResponding={isResponding}
        onRespond={(response) => submitResponse(round.pairingId, response)}
      />
      <VideoControls
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        // #18: hanging up mid-session is not recoverable, so it now asks first.
        onEnd={() => setConfirmLeave(true)}
      />

      <AlertModal
        visible={confirmLeave}
        tone="warning"
        title={i18n.t('round_leave_title')}
        message={i18n.t('round_leave_body')}
        confirmLabel={i18n.t('round_leave_confirm')}
        onConfirm={leave}
        onDismiss={() => setConfirmLeave(false)}
      />
      <AlertModal
        visible={respondError}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={clearRespondError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.xxxl },
  status: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center' },
  errorTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: COLORS.text, textAlign: 'center' },
});
