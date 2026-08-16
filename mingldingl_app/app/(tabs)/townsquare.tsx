import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GameHeader } from '../../components/ui/GameHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { SessionStatusCard } from '../../components/townsquare/SessionStatusCard';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS } from '../../lib/theme';

const PARCHMENT_ASSET = require('../../assets/textures/parchment.png');

export default function TownSquareScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const router = useRouter();
  const { session, rsvp, cancelRsvp, isRsvping, isCancelling } = useTownSquareSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (session?.sessionId && session.status === 'InProgress') {
      router.push(`/townsquare-round/${session.sessionId}` as any);
    }
  }, [session?.sessionId, session?.status, router]);

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={PARCHMENT_ASSET} opacity={0.08} />
      <GameHeader title={i18n.t('town_square_title')} icon="account-group" />
      <View style={styles.content}>
        <SessionStatusCard
          session={session}
          now={now}
          onRsvp={rsvp}
          onCancelRsvp={cancelRsvp}
          isRsvping={isRsvping}
          isCancelling={isCancelling}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingTop: 16 },
});
