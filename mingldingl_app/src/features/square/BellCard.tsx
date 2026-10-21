import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { CANDLELIT_PAD, Candlelit } from '@/design/components/Candlelit';
import { Swing } from '@/design/components/Swing';
import { Txt } from '@/design/components/Txt';
import { color, type } from '@/design/tokens';
import type { GatheringView } from '@/lib/api/generated/model';
import { getLocale, t, tCount } from '@/lib/i18n';
import { clock } from '../common/time';

export const dayName = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', { weekday: 'long' });

/**
 * The next gathering (Figma 26:717), inside the gold line: the bell, its name, when and how long, the
 * seats, and the seat. Every gathering's card is the same size, whatever its name or festival.
 */
export function BellCard({ g, onTake, busy }: { g: GatheringView; onTake: () => void; busy: boolean }) {
  const full = g.sideTaken >= g.sideSeats;
  return (
    <View style={styles.card}>
      <Candlelit fill={color.bgPanel} />
      <Swing>
        <Art name="square_bell" style={styles.bell} fit="cover" />
      </Swing>
      {/* One line, shrunk to fit: a long festival name never makes this card taller than another. */}
      <Txt
        variant="displayL"
        align="center"
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {g.name}
      </Txt>
      <Txt variant="bodyS" color="textSecondary" align="center" numberOfLines={2} style={styles.meta}>
        {t('square.meta', {
          day: dayName(g.startsAt),
          time: clock(g.startsAt),
          rounds: tCount('square.rounds', g.rounds, { minutes: g.roundMinutes }),
        })}
      </Txt>
      <Txt variant="labelM" color={full ? 'textMuted' : 'textAccent'} align="center">
        {(full ? t('square.sideFull') : t('square.seats', { taken: g.taken, seats: g.seats })).toUpperCase()}
      </Txt>
      <Button label={t('square.take')} onPress={onTake} disabled={full} loading={busy} />
    </View>
  );
}

/** Bell 80, name 38, two lines of when 42, seats 18, button 52, four gaps of 10, and the gold line's pad. */
const CARD_H = 80 + 38 + 42 + 18 + 52 + 4 * 10 + 2 * CANDLELIT_PAD;

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CANDLELIT_PAD,
    paddingVertical: CANDLELIT_PAD,
  },
  bell: { width: 80, height: 80 },
  meta: { height: 2 * type.bodyS.lineHeight, textAlignVertical: 'center' },
});
