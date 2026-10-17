import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Swing } from '@/design/components/Swing';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import type { GatheringView } from '@/lib/api/generated/model';
import { getLocale, t, tCount } from '@/lib/i18n';
import { clock } from '../common/time';

export const dayName = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', { weekday: 'long' });

/** The next gathering (Figma 26:717): the bell, its name, when and how long, the seats, and the seat. */
export function BellCard({ g, onTake, busy }: { g: GatheringView; onTake: () => void; busy: boolean }) {
  const full = g.sideTaken >= g.sideSeats;
  return (
    <View style={styles.card}>
      <Swing>
        <Art name="square_bell" style={styles.bell} fit="cover" />
      </Swing>
      <Txt variant="displayL" align="center" accessibilityRole="header">
        {g.name}
      </Txt>
      <Txt variant="bodyS" color="textSecondary" align="center">
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

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: 22,
    paddingBottom: dimension.space5,
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderBrass,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
  },
  bell: { width: 80, height: 80 },
});
