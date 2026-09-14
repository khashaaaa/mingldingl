import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Tap } from '../ui/Tap';
import { useRouter } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { formatCountdown } from '../../lib/townSquareTime';
import { worldWhen, worldWhenText, worldTimeSpoken } from '../../lib/worldTime';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, LEADING, LINE, SPACE, TRACKING } from '../../lib/theme';
// The Town Square tab already shows the full session state; this is the same countdown boiled
// down to one line so the next gathering stays visible from the tabs people actually live on.
// It reuses the tab's query (and its polling) rather than opening a second one.
export function NextGatheringPill() {
  const router = useRouter();
  const { session } = useTownSquareSession();
  const [now, setNow] = useState(() => Date.now());

  const hasSession = session?.sessionId != null;
  useEffect(() => {
    if (!hasSession) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasSession]);

  if (!session || !hasSession) return null;

  // The whole pill navigates, so there's no tap-to-reveal toggle here the way SessionStatusCard's
  // WorldClock has one — the world's phrasing is the only thing on screen, and the accessibility
  // label carries the exact clock alongside it so a screen reader still gets the precise number.
  let label: string;
  let accessibilityLabel: string;
  if (session.status === 'InProgress') {
    label = i18n.t('gathering_under_way');
    accessibilityLabel = label;
  } else {
    const isOpen = session.status === 'Open';
    const targetIso = isOpen ? session.rsvpClosesAt : session.scheduledStartAt;
    const exact = i18n.t(isOpen ? 'gathering_rsvp_closes' : 'gathering_starts_in', {
      time: formatCountdown(targetIso, now),
    });
    const spoken = worldTimeSpoken();
    label = spoken
      ? i18n.t(isOpen ? 'gates_close' : 'first_bell', { when: worldWhenText(worldWhen(targetIso, now)) })
      : exact;
    // Mongolian is already on the exact clock, so `label` *is* `exact` there — pairing them would
    // read the same sentence out twice.
    accessibilityLabel = spoken ? `${label} ${exact}` : exact;
  }

  return (
    <Tap
      style={styles.wrap}
      onPress={() => router.push('/(tabs)/townsquare')}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      testID="next-gathering-pill"
    >
      <Icon name="bugle" size={ICON_SIZES.sm} color={ACCENT.base} />
      {/* Two lines: the world's sentence runs long in Mongolian, and one line clipped it mid-word. */}
      <Text style={styles.text} numberOfLines={2}>{label}</Text>
      {session.isRsvpd && (
        <View testID="next-gathering-rsvpd">
          <Icon name="check-bold" size={ICON_SIZES.xs} color={ACCENT.base} />
        </View>
      )}
    </Tap>
  );
}

// A hairline row rather than a bordered pill: it goes somewhere, it is not a state, and the kit
// draws a way into a room as a row with its rule under it, never as a chip.
const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    alignSelf: 'stretch',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 1,
    borderBottomColor: LINE.hairline,
  },
  text: {
    flexShrink: 1, textAlign: 'center',
    fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, lineHeight: LEADING.sm,
    color: ACCENT.base, letterSpacing: TRACKING.label,
  },
});
