import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { GameHeader } from '../../components/ui/GameHeader';
import { GameButton } from '../../components/ui/GameButton';
import { SessionStatusCard } from '../../components/townsquare/SessionStatusCard';
import { NextGatheringPill } from '../../components/townsquare/NextGatheringPill';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { i18n } from '../../lib/i18n';
import { getApiErrorMessage, isApiError } from '../../lib/api/errors';
import { useLocaleStore } from '../../store/localeStore';
import { SPACE } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';
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
          <StateBlock tone="danger" icon="alert-circle-outline" title={getApiErrorMessage(error, i18n.t('screen_load_error'))}>
            <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
          </StateBlock>
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
        {/* Moved off Seek (task-8). The brief's default spot is "above the session card," but this
            card already spells out the same countdown (SessionStatusCard's RSVP/starts-in copy),
            so the pill rides beside it here — right after the card — instead of duplicating that
            copy at the top of the screen. Renders its own null when there's nothing to show. */}
        <NextGatheringPill />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingTop: SPACE.lg },
});
