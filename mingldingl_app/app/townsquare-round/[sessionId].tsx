import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { VideoControls } from '../../components/video/VideoControls';
import { RoundPrompt } from '../../components/townsquare/RoundPrompt';
import { useTownSquareRound } from '../../hooks/useTownSquareRound';
import { COLORS } from '../../lib/theme';
import { useLocaleStore } from '../../store/localeStore';

export default function TownSquareRoundScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { round, error, markJoined, submitResponse, hasResponded, matchId } = useTownSquareRound(sessionId);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // A 400/404 here means the session is no longer in-progress for this user
  // (completed, cancelled, or their round has no pairing) — the poll can't
  // recover from that on its own, so leave rather than keep retrying.
  useEffect(() => {
    if (error) router.replace('/(tabs)/townsquare' as any);
  }, [error, router]);

  if (!round) return <View style={styles.screen} />;

  const secondsLeft = Math.max(0, Math.round((new Date(round.roundEndsAt).getTime() - now) / 1000));

  return (
    <View style={styles.screen}>
      <AgoraVideoCall
        token={{ token: round.videoToken, channelName: round.channelName, appId: round.appId }}
        muted={muted}
        cameraOff={cameraOff}
        onJoined={() => markJoined(round.pairingId)}
        onError={() => {}}
      />
      <RoundPrompt
        icebreakerText={round.icebreakerText}
        roundNumber={round.roundNumber}
        secondsLeft={secondsLeft}
        hasResponded={hasResponded}
        matchId={matchId}
        onRespond={(response) => submitResponse(round.pairingId, response)}
      />
      <VideoControls
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        onEnd={() => router.replace('/(tabs)/townsquare' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
});
