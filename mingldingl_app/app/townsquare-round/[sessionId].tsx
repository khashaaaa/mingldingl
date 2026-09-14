import { useEffect, useState } from 'react';
import { Tap } from '../../components/ui/Tap';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { VideoControls } from '../../components/video/VideoControls';
import { RoundPrompt } from '../../components/townsquare/RoundPrompt';
import { AlertModal } from '../../components/modals/AlertModal';
import { ReportUserSheet } from '../../components/modals/ReportUserSheet';
import { GameButton } from '../../components/ui/GameButton';
import { Glyph } from '../../components/ui/Glyph';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Icon } from '../../components/ui/Icon';
import { LongWait } from '../../components/ui/LongWait';
import { useTownSquareRound, useTownSquareSessionSummary } from '../../hooks/useTownSquareRound';
import { cap } from '../../lib/fire';
import { ordinalWord } from '../../lib/worldTime';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE, TEMPERATURE } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';

/** `m:ss`, floored at zero — the round screen is on the furnace allow-list, so this is the one
 *  place the countdown itself lives now that the bell title carries the round number. */
function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default function TownSquareRoundScreen() {
  useLocaleStore((s) => s.locale);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { round, isLoading, connectionLost, markJoined, submitResponse, hasResponded, matchId, isResponding, respondError, clearRespondError, joinError, clearJoinError } =
    useTownSquareRound(sessionId);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [callFailed, setCallFailed] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
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
  const summary = useTownSquareSessionSummary(sessionId, connectionLost);

  // A gathering reaching its last round is the normal, intended ending — it used to arrive here
  // as a failed request and be reported as "you left the square, the session moved on without
  // you", then drop the user on a tab whose next-session no longer knew this one existed. The
  // matches made in it were never surfaced anywhere at all.
  if (connectionLost && summary?.status === 'Completed') {
    return (
      <StateBlock
        tone="good"
        icon="party-popper"
        title={i18n.t('round_over_title')}
        body={i18n.t('round_over_body', { count: summary.roundsPlayed })}
      >

        {summary.matches.length === 0 ? (
          <Text style={styles.status}>{i18n.t('round_over_no_matches')}</Text>
        ) : (
          <View style={styles.matchList}>
            {/* The count-aware line above the rows: what happened, and where it went. The header
                below it names the list itself, so the two are not the same sentence twice — one
                reports, one introduces. */}
            <Text style={styles.status}>
              {summary.matches.length === 1
                ? i18n.t('plaza_closed_lit_one')
                : i18n.t('plaza_closed_lit', { count: summary.matches.length })}
            </Text>
            <Text style={styles.status}>{i18n.t('round_over_matches')}</Text>
            {summary.matches.map((m) => (
              <View key={m.matchId} style={styles.matchRow}>
                <View testID="match-lantern">
                  <Glyph name="lantern" size={ICON_SIZES.sm} color={ACCENT.base} />
                </View>
                <GameButton
                  variant="ink"
                  size="compact"
                  flex={1}
                  onPress={() => router.replace(`/chat/${m.matchId}` as any)}
                >
                  {m.displayName || i18n.t('mystery_match_name')}
                </GameButton>
              </View>
            ))}
          </View>
        )}

        <GameButton variant="ink" size="compact" onPress={leave}>
          {i18n.t('town_square_rejoin')}
        </GameButton>
      </StateBlock>
    );
  }

  // #17: an error used to bounce the user out silently; now they are told before leaving.
  if (connectionLost) {
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
      <View style={[styles.screen, styles.center, styles.waitGround]}>
        <LongWait kind="squareRound" />
      </View>
    );
  }

  const secondsLeft = Math.max(0, Math.round((new Date(round.roundEndsAt).getTime() - now) / 1000));

  return (
    <View style={styles.screen}>
      {/* The bell title names the round in blackletter (Latin only — `ordinalWord` under `en`,
          never a Cyrillic variant); the back arrow now routes through the same confirm-before-
          leaving dialog the hang-up button uses, rather than `router.back()` walking out of a
          live call unasked. The report flag moved in here from its own floating chip: a header
          was not on this screen before, and left where it was it would have sat over the top of
          this one. */}
      <HeaderBar
        title={i18n.t('bell_title', { ordinal: cap(ordinalWord(round.roundNumber)) })}
        onBack={() => setConfirmLeave(true)}
        // A live call is on screen: the hearth tap and the atlas sigil both `router.push` while
        // leaving this screen mounted underneath, so the call's `leaveChannel()` cleanup would
        // never run and the camera/mic would keep publishing with no controls on screen. Only the
        // back arrow (already routed through the leave-confirmation dialog above) may exit.
        chrome={false}
        right={
          // A Town Square partner is a stranger with no match to reach them through, so this is
          // the only place they can be reported from. Reporting also blocks them, which keeps
          // the round-robin from ever seating the two of them together again.
          <Tap
            style={styles.reportButton}
            accessibilityLabel={i18n.t('report_user')}
            onPress={() => setReportVisible(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="flag" size={ICON_SIZES.sm} color={INK.primary} />
          </Tap>
        }
      >
        {/* `town_square_round_label` still names the round for a screen reader; grouped here so
            the label carries the seconds too (a grouped view silences its children otherwise),
            and the bell glyph — carrying nothing the label doesn't already say — stays decorative. */}
        <View
          style={styles.bellRow}
          accessible
          accessibilityLabel={`${i18n.t('town_square_round_label', { round: round.roundNumber })}. ${formatClock(secondsLeft)}`}
        >
          <Glyph name="bell" size={ICON_SIZES.md} color={TEMPERATURE.furnace} />
          <Text style={styles.countdown} importantForAccessibility="no">{formatClock(secondsLeft)}</Text>
        </View>
      </HeaderBar>

      {/* #15: a failed connection used to leave a blank screen with no way forward. */}
      {callFailed ? (
        <StateBlock
          tone="danger"
            icon="video-off"
          title={i18n.t('round_connect_error_title')}
          body={i18n.t('round_connect_error_body')}
        >
          <GameButton
            variant="primary"
            onPress={() => { setCallFailed(false); setAttempt((a) => a + 1); }}
          >
            {i18n.t('rejoin')}
          </GameButton>
          <GameButton variant="ink" size="compact" onPress={leave}>
            {i18n.t('round_leave_confirm')}
          </GameButton>
        </StateBlock>
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

      {/* A dropped call has nothing to answer for: showing this beside the "Rejoin" state block
          above let the user light a bell for a conversation the video side had already left. */}
      {!callFailed && (
        <RoundPrompt
          icebreakerText={round.icebreakerText}
          hasResponded={hasResponded}
          matchId={matchId}
          isResponding={isResponding}
          onRespond={(response) => submitResponse(round.pairingId, response)}
        />
      )}

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
  // Now a plain tail icon in the header row (`HeaderBar`'s own hearth tap and atlas sigil carry
  // no chip either), rather than a chip floating over the video — the header claimed that top-right
  // corner first.
  reportButton: { padding: SPACE.sm },
  bellRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  countdown: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: TEMPERATURE.furnaceBright },
  // Transparent, not `SURFACE.ground`: this route is in the tavern room (`lib/world/rooms.ts`),
  // so the world's floor, light ramp and vfx render beneath it. It was the one lit screen
  // painting an opaque ground over all three.
  screen: { flex: 1, backgroundColor: 'transparent' },
  waitGround: { backgroundColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.xxxl },
  status: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim, textAlign: 'center' },
  matchList: { alignSelf: 'stretch', gap: SPACE.sm },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
});
