import { View, Text, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { ordinalWord } from '../../lib/worldTime';
import { formatDate } from '../../lib/formatDate';
import { FONTS, FONT_SIZES, INK, LINE, SPACE, TRACKING } from '../../lib/theme';

interface Props {
  /** The thread's own day count (see `threadDay`), or null once it falls off the ladder. */
  day: number | null;
  iso: string;
}

/**
 * A hairline-text-hairline divider between days in the ledger — "THE THIRD DAY", or the plain
 * date once the thread has run long enough that counting days stops being useful.
 */
export function DayHeading({ day, iso }: Props) {
  const label = day !== null ? i18n.t('thread_day', { ordinal: ordinalWord(day) }) : formatDate(iso);
  return (
    <View style={styles.row}>
      <View style={styles.hairline} />
      <Text style={styles.text}>{label.toUpperCase()}</Text>
      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginVertical: SPACE.lg },
  hairline: { height: 1, flex: 1, backgroundColor: LINE.edge },
  text: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, letterSpacing: TRACKING.eyebrow, color: INK.dim },
});
