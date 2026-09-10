import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { formatCountdown } from '../../lib/townSquareTime';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE } from '../../lib/theme';

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

  let label: string;
  if (session.status === 'InProgress') {
    label = i18n.t('gathering_under_way');
  } else if (session.status === 'Open') {
    label = i18n.t('gathering_rsvp_closes', { time: formatCountdown(session.rsvpClosesAt, now) });
  } else {
    label = i18n.t('gathering_starts_in', { time: formatCountdown(session.scheduledStartAt, now) });
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() => router.push('/(tabs)/townsquare')}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="next-gathering-pill"
    >
      <Icon name="bugle" size={ICON_SIZES.sm} color={COLORS.gold} />
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
      {session.isRsvpd && (
        <View testID="next-gathering-rsvpd">
          <Icon name="check-bold" size={ICON_SIZES.xs} color={COLORS.gold} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  pressed: { opacity: 0.8 },
  text: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, color: COLORS.gold, letterSpacing: 0.5 },
});
