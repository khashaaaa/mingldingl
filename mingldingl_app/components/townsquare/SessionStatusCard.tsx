import { Text, View, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { formatCountdown } from '../../lib/townSquareTime';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE } from '../../lib/theme';
import type { TownSquareNextSession } from '../../hooks/useTownSquareSession';
import { Icon } from '../ui/Icon';

interface Props {
  session: TownSquareNextSession | undefined;
  now: number;
  onRsvp: (sessionId: string) => void;
  onCancelRsvp: (sessionId: string) => void;
  onEnter: (sessionId: string) => void;
  isRsvping: boolean;
  isCancelling: boolean;
}

export function SessionStatusCard({ session, now, onRsvp, onCancelRsvp, onEnter, isRsvping, isCancelling }: Props) {
  if (!session?.sessionId) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <Icon name="bank" size={ICON_SIZES.xxl} color={COLORS.bronze} />
          <Text style={styles.emptyTitle}>{i18n.t('town_square_empty_title')}</Text>
          <Text style={styles.emptySub}>{i18n.t('town_square_empty_sub')}</Text>
        </View>
      </View>
    );
  }

  const isOpen = session.status === 'Open';
  const isInProgress = session.status === 'InProgress';
  const startsCountdown = formatCountdown(session.scheduledStartAt, now);

  // An in-progress session used to render a frozen countdown with no way back in, which stranded
  // anyone who left a round (or was bumped out) for the rest of the session.
  if (isInProgress) {
    return (
      <AppCard style={styles.card}>
        <Text style={styles.title}>{i18n.t('town_square_title')}</Text>
        <Text style={styles.countdown}>{i18n.t('town_square_in_progress')}</Text>
        {session.isRsvpd && (
          <GameButton variant="primary" icon="bank" onPress={() => onEnter(session.sessionId!)}>
            {i18n.t('town_square_rejoin')}
          </GameButton>
        )}
      </AppCard>
    );
  }

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
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.gold, letterSpacing: 1 },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  countdown: { fontFamily: FONTS.displayBlack, fontSize: FONT_SIZES.title, color: COLORS.text },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.gutter },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    padding: SPACE.giant,
    alignItems: 'center',
    gap: SPACE.md,
  },
  emptyTitle: { fontSize: FONT_SIZES.title, fontFamily: FONTS.display, color: COLORS.text },
  emptySub: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
