import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GameHeader } from '../../components/ui/GameHeader';
import { GameButton } from '../../components/ui/GameButton';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { SessionStatusCard } from '../../components/townsquare/SessionStatusCard';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS } from '../../lib/theme';

const PARCHMENT_ASSET = require('../../assets/textures/parchment.png');

const autoNavigatedSessions = new Set<string>();

export default function TownSquareScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { session, isError, refetch, rsvp, cancelRsvp, isRsvping, isCancelling } = useTownSquareSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (
      session?.sessionId &&
      session.status === 'InProgress' &&
      !autoNavigatedSessions.has(session.sessionId)
    ) {
      autoNavigatedSessions.add(session.sessionId);
      router.push(`/townsquare-round/${session.sessionId}` as any);
    }
  }, [session?.sessionId, session?.status, router]);

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={PARCHMENT_ASSET} opacity={0.08} />
      <GameHeader title={i18n.t('town_square_title')} icon="account-group" />
      <View style={styles.content}>
        {isError && !session ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{i18n.t('screen_load_error')}</Text>
            <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </View>
        ) : (
          <SessionStatusCard
            session={session}
            now={now}
            onRsvp={rsvp}
            onCancelRsvp={cancelRsvp}
            isRsvping={isRsvping}
            isCancelling={isCancelling}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingTop: 16 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 16, textAlign: 'center' },
});
