import { StyleSheet, View } from 'react-native';
import { Glyph } from './Art';
import { Txt } from './Txt';

/**
 * The seven dawns (Figma "Dawn Streak"), in the Chronicle's ink: a rising sun per day returned,
 * gold when it has risen and a faint stroke while it waits; the seventh is the star. `lit` is how
 * many of the seven have risen; the line beneath says what they mean.
 */
export function DawnStreak({ lit, line, of = 7 }: { lit: number; line: string; of?: number }) {
  const full = lit >= of;
  return (
    <View accessible accessibilityLabel={line} style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: of }, (_, i) => {
          const on = i < lit;
          const seventh = i === of - 1;
          return (
            <Glyph
              // biome-ignore lint/suspicious/noArrayIndexKey: a dawn is its place in the row
              key={i}
              name={seventh ? 'star' : 'dawn'}
              size={seventh ? 32 : 28}
              tint={on ? (seventh ? 'accentGoldBright' : 'accentGold') : 'borderStrong'}
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
  // the dawns rise on one line
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 36 },
});
