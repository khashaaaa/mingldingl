import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { VideoControls } from '../../components/video/VideoControls';
import { RoundPrompt } from '../../components/townsquare/RoundPrompt';
import { AlertModal } from '../../components/modals/AlertModal';
import { ReportUserSheet } from '../../components/modals/ReportUserSheet';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { useTownSquareRound, useTownSquareSessionSummary } from '../../hooks/useTownSquareRound';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, SPACE, circle, overlay } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';

export default function TownSquareRoundScreen() {
  useLocaleStore((s) => s.locale);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { round, isLoading, error, markJoined, submitResponse, hasResponded, matchId, isResponding, respondError, clearRespondError, joinError, clearJoinError } =
    useTownSquareRound(sessionId);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [callFailed, setCallFailed] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function leave() {
    router.replace('/(tabs)/townsquare' as any);
  }

  // Only asked for once the round has failed: a session that is not InProgress is refused by
  // `currentRound`, and this is what says whether that is because it finished or because this
  // user is no longer in it.
  const summary = useTownSquareSessionSummary(sessionId, !!error);

  // A gathering reaching its last round is the normal, intended ending — it used to arrive here
  // as a failed request and be reported as "you left the square, the session moved on without
  // you", then drop the user on a tab whose next-session no longer knew this one existed. The
  // matches made in it were never surfaced anywhere at all.
  if (error && summary?.status === 'Completed') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Icon name="party-popper" size={ICON_SIZES.hero} color={COLORS.gold} />
        <Text style={styles.errorTitle}>{i18n.t('round_over_title')}</Text>
        <Text style={styles.status}>
          {i18n.t('round_over_body', { count: summary.roundsPlayed })}
        </Text>

        {summary.matches.length === 0 ? (
          <Text style={styles.status}>{i18n.t('round_over_no_matches')}</Text>
        ) : (
          <View style={styles.matchList}>
            <Text style={styles.status}>{i18n.t('round_over_matches')}</Text>
            {summary.matches.map((m) => (
              <GameButton
                key={m.matchId}
                variant="primary"
                size="compact"
                icon="chat"
                onPress={() => router.replace(`/chat/${m.matchId}` as any)}
              >
                {m.displayName || i18n.t('mystery_match_name')}
              </GameButton>
            ))}
          </View>
        )}

        <GameButton variant="ghost" size="compact" onPress={leave}>
          {i18n.t('town_square_rejoin')}
        </GameButton>
      </View>
    );
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
          <Icon name="video-off" size={ICON_SIZES.hero} color={COLORS.emberLight} />
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
      {/* A Town Square partner is a stranger with no match to reach them through, so this is the
          only place they can be reported from. Reporting also blocks them, which keeps the
          round-robin from ever seating the two of them together again. */}
      <TouchableOpacity
        style={[styles.reportButton, { top: insets.top + SPACE.sm }]}
        accessibilityLabel={i18n.t('report_user')}
        onPress={() => setReportVisible(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Icon name="flag" size={ICON_SIZES.sm} color={COLORS.text} />
      </TouchableOpacity>

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
      {/* A failed join is silent otherwise, and attendance for the round goes unrecorded. */}
      <AlertModal
        visible={joinError}
        tone="warning"
        title={i18n.t('round_join_failed_title')}
        message={i18n.t('round_join_failed_body')}
        confirmLabel={i18n.t('retry')}
        onConfirm={() => { clearJoinError(); markJoined(round.pairingId); }}
        onDismiss={clearJoinError}
      />
      <ReportUserSheet
        visible={reportVisible}
        reportedUserId={round.partnerUserId}
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top-right, clear of the video controls at the bottom and of the round prompt in the middle.
  reportButton: {
    position: 'absolute',
    right: SPACE.md,
    ...circle(36),
    backgroundColor: overlay(0.75),
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.xxxl },
  status: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center' },
  errorTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: COLORS.text, textAlign: 'center' },
  matchList: { alignSelf: 'stretch', gap: SPACE.sm },
});
