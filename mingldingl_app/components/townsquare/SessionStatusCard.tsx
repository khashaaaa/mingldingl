import { useState } from 'react';
import { Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { WorldClock } from '../ui/WorldClock';
import { Plaza } from './Plaza';
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

/** Assumed width until `onLayout` reports the real one — the pattern `app/hearth.tsx` uses for
 *  its own `SkyWindow`. */
const FALLBACK_PLAZA_WIDTH = 320;

export function SessionStatusCard({ session, now, onRsvp, onCancelRsvp, onEnter, isRsvping, isCancelling }: Props) {
  const festival = useActiveFestival();
  const [plazaWidth, setPlazaWidth] = useState(FALLBACK_PLAZA_WIDTH);

  function onPlazaLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== plazaWidth) setPlazaWidth(w);
  }

  if (!session?.sessionId) {
    return (
      <View style={styles.emptyWrap}>
        <StateBlock
          framed
          icon="door"
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

  // Locked reads the same as Open but shut: the gates carry no bar until the roster is, and the
  // sub line names whichever half of "the gates close, N are in" is still true.
  const subKey = !isOpen
    ? 'plaza_sub_locked'
    : session.isRsvpd
      ? 'plaza_sub_open'
      : 'plaza_sub_open_not_mine';

  return (
    <AppCard hero style={styles.card}>
      {festivalEyebrow}
      {/* The screen's header already says "Town Square"; the card's own title is the date it
          names — the one fact the plaza's drawing does not carry. */}
      <Text style={styles.title}>{formatDateTime(session.scheduledStartAt)}</Text>
      <View onLayout={onPlazaLayout}>
        <Plaza width={plazaWidth} lanterns={session.rsvpCount} mine={session.isRsvpd} open={isOpen} />
      </View>
      <Text style={styles.sub}>
        {i18n.t(subKey, { count: session.rsvpCount })}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <CardEyebrow style={styles.statLabel}>{i18n.t('plaza_first_bell')}</CardEyebrow>
          <WorldClock
            targetIso={session.scheduledStartAt}
            nowMs={now}
            worldKey="first_bell"
            exactKey="town_square_starts_in"
            style={styles.statValue}
          />
        </View>
        {/* While Open, `roundCount` is the engine's `MaxPerSide` — an upper bound, not the real
            count. The real count (`min(men, women)`) is only fixed once the roster locks, so
            stating it as fact while gates are still open would tell the plaza a number that has
            not happened yet. */}
        {!isOpen && (
          <View style={styles.stat}>
            <CardEyebrow style={styles.statLabel}>{i18n.t('plaza_rounds')}</CardEyebrow>
            <Text style={styles.statValue}>{i18n.t('plaza_rounds_value', { count: session.roundCount })}</Text>
          </View>
        )}
      </View>
      {isOpen && (
        <WorldClock
          targetIso={session.rsvpClosesAt}
          nowMs={now}
          worldKey="gates_close"
          exactKey="town_square_rsvp_closes_in"
          style={styles.hint}
          testID="session-gates-close"
        />
      )}
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
  // Italic is the app speaking (the Sealed Fire's three voices) — this line is the world's own
  // account of the gates and the lanterns, not a person's.
  sub: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim },
  statsRow: { flexDirection: 'row', gap: SPACE.lg },
  stat: { flex: 1 },
  statLabel: { marginBottom: SPACE.xs },
  statValue: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.gutter },
});
