import { Text, View, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { formatCountdown } from '../../lib/townSquareTime';
import { formatDateTime } from '../../lib/formatDate';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { StateBlock } from '../ui/StateBlock';
import type { TownSquareNextSession } from '../../hooks/useTownSquareSession';
import { Icon } from '../ui/Icon';
import { CardEyebrow } from '../ui/CardEyebrow';
import { useActiveFestival } from '../../lib/festivals';

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
  const festival = useActiveFestival();
  if (!session?.sessionId) {
    return (
      <View style={styles.emptyWrap}>
        <StateBlock
          framed
          icon="bank"
          title={i18n.t('town_square_empty_title')}
          body={i18n.t('town_square_empty_sub')}
        />
      </View>
    );
  }

  const festivalEyebrow = festival && (
    <View style={styles.festivalRow} testID="festival-eyebrow">
      <Icon name={festival.icon} size={ICON_SIZES.sm} color={festival.color} />
      <CardEyebrow color={festival.color} style={styles.festivalText}>
        {i18n.t('festival_gathering', { festival: i18n.t(festival.nameKey) })}
      </CardEyebrow>
    </View>
  );

  const isOpen = session.status === 'Open';
  const isInProgress = session.status === 'InProgress';
  const startsCountdown = formatCountdown(session.scheduledStartAt, now);

  // An in-progress session used to render a frozen countdown with no way back in, which stranded
  // anyone who left a round (or was bumped out) for the rest of the session.
  if (isInProgress) {
    return (
      <AppCard style={styles.card}>
        {festivalEyebrow}
        <Text style={styles.title}>{formatDateTime(session.scheduledStartAt)}</Text>
        <Text style={styles.countdown}>{i18n.t('town_square_in_progress')}</Text>
        {session.isRsvpd && (
          <GameButton variant="ink" icon="bank" onPress={() => onEnter(session.sessionId!)}>
            {i18n.t('town_square_rejoin')}
          </GameButton>
        )}
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.card}>
      {festivalEyebrow}
      {/* The screen's header already says "Town Square"; the card's own title is the date it
          names — the one fact the countdown below does not carry. */}
      <Text style={styles.title}>{formatDateTime(session.scheduledStartAt)}</Text>
      {isOpen && (
        <Text style={styles.hint}>{i18n.t('town_square_rsvp_closes_in', { time: formatCountdown(session.rsvpClosesAt, now) })}</Text>
      )}
      <Text style={styles.countdown}>{i18n.t('town_square_starts_in', { time: startsCountdown })}</Text>
      {isOpen && (
        session.isRsvpd ? (
          <GameButton variant="ink" onPress={() => onCancelRsvp(session.sessionId!)} loading={isCancelling}>
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
  festivalRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  festivalText: { marginBottom: 0 },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: ACCENT.base, letterSpacing: TRACKING.wide },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  countdown: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: INK.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.gutter },
});
