import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { GameHeader } from '../../components/ui/GameHeader';
import { GameButton } from '../../components/ui/GameButton';
import { SessionStatusCard } from '../../components/townsquare/SessionStatusCard';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { i18n } from '../../lib/i18n';
import { getApiErrorMessage, isApiError } from '../../lib/api/errors';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';


const autoNavigatedSessions = new Set<string>();

export default function TownSquareScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { session, isError, error, refetch, rsvp, cancelRsvp, isRsvping, isCancelling } = useTownSquareSession();
  const [now, setNow] = useState(() => Date.now());
  // The switch can flip while a session is cached; the closed notice must win over stale data.
  const closed = isApiError(error, 'square.disabled');

  // Tab screens stay mounted, so an unconditional ticker re-rendered this screen every second
  // while the user was elsewhere in the app.
  useFocusEffect(useCallback(() => {
    if (!session?.sessionId) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session?.sessionId]));

  const enterRound = useCallback((sessionId: string) => {
    router.push(`/townsquare-round/${sessionId}` as any);
  }, [router]);

  useEffect(() => {
    if (
      session?.sessionId &&
      session.status === 'InProgress' &&
      !autoNavigatedSessions.has(session.sessionId)
    ) {
      autoNavigatedSessions.add(session.sessionId);
      enterRound(session.sessionId);
    }
  }, [session?.sessionId, session?.status, enterRound]);

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('town_square_title')} icon="account-group" />
      <View style={styles.content}>
        {closed || (isError && !session) ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{getApiErrorMessage(error, i18n.t('screen_load_error'))}</Text>
            <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </View>
        ) : (
          <SessionStatusCard
            session={session}
            now={now}
            onRsvp={rsvp}
            onCancelRsvp={cancelRsvp}
            onEnter={enterRound}
            isRsvping={isRsvping}
            isCancelling={isCancelling}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingTop: SPACE.lg },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.md },
  errorText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, textAlign: 'center' },
});
