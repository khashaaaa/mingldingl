import { Text, View, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { formatCountdown } from '../../lib/townSquareTime';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS, SPACE } from '../../lib/theme';
import type { TownSquareNextSession } from '../../hooks/useTownSquareSession';

interface Props {
  session: TownSquareNextSession | undefined;
  now: number;
  onRsvp: (sessionId: string) => void;
  onCancelRsvp: (sessionId: string) => void;
  isRsvping: boolean;
  isCancelling: boolean;
}

export function SessionStatusCard({ session, now, onRsvp, onCancelRsvp, isRsvping, isCancelling }: Props) {
  if (!session?.sessionId) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏛️</Text>
          <Text style={styles.emptyTitle}>{i18n.t('town_square_empty_title')}</Text>
          <Text style={styles.emptySub}>{i18n.t('town_square_empty_sub')}</Text>
        </View>
      </View>
    );
  }

  const isOpen = session.status === 'Open';
  const startsCountdown = formatCountdown(session.scheduledStartAt, now);

  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>{i18n.t('town_square_title')}</Text>
      {isOpen && (
        <Text style={styles.hint}>{i18n.t('town_square_rsvp_closes_in', { time: formatCountdown(session.rsvpClosesAt, now) })}</Text>
      )}
      <Text style={styles.countdown}>{i18n.t('town_square_starts_in', { time: startsCountdown })}</Text>
      {isOpen && (
        session.isRsvpd ? (
          <GameButton variant="ghost" onPress={() => onCancelRsvp(session.sessionId!)} loading={isCancelling}>
            {i18n.t('town_square_cancel_rsvp')}
          </GameButton>
        ) : (
          <GameButton variant="primary" onPress={() => onRsvp(session.sessionId!)} loading={isRsvping}>
            {i18n.t('town_square_rsvp')}
          </GameButton>
        )
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.gold, letterSpacing: 1 },
  hint: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  countdown: { fontFamily: FONTS.displayBlack, fontSize: 22, color: COLORS.text },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.display, color: COLORS.text },
  emptySub: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
