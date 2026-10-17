import { StyleSheet, View } from 'react-native';
import { boxShadow } from '../effects';
import { color, dimension } from '../tokens';
import { Txt } from './Txt';

/**
 * The seven dawns (Figma "Dawn Streak"): a dot per day returned in a row, the seventh larger and
 * ember when it lands. `lit` is how many of the seven burn; the line beneath says what they mean.
 */
export function DawnStreak({ lit, line, of = 7 }: { lit: number; line: string; of?: number }) {
  const full = lit >= of;
  return (
    <View accessible accessibilityLabel={line} style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: of }, (_, i) => {
          const last = i === of - 1;
          const on = i < lit;
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: a dawn is its place in the row
              key={i}
              style={[
                styles.dot,
                last && styles.last,
                on ? (last ? styles.ember : styles.gold) : styles.dark,
              ]}
            />
          );
        })}
      </View>
      <Txt variant="voiceM" color={full ? 'textAccent' : 'textSecondary'}>
        {line}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 30 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: dimension.strokeHairline },
  last: { width: 30, height: 30, borderRadius: 15 },
  dark: { backgroundColor: color.bgSunken, borderColor: color.borderHairline },
  gold: {
    backgroundColor: color.accentGold,
    borderColor: color.accentGoldBright,
    boxShadow: boxShadow('glowGold'),
  },
  ember: {
    backgroundColor: color.accentEmber,
    borderColor: color.accentGoldBright,
    boxShadow: boxShadow('glowEmber'),
  },
});
