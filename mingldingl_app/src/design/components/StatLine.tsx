import { StyleSheet, View } from 'react-native';
import { color, dimension } from '../tokens';
import { Txt } from './Txt';

/** A labelled line of standing (Figma "Stat Line"): a small caps label beside its value. */
export function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}. ${value}`} style={styles.row}>
      <Txt variant="labelM" color="textMuted" style={styles.label}>
        {label.toUpperCase()}
      </Txt>
      <Txt variant="bodyS" style={styles.value}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: dimension.space3,
    paddingVertical: 10,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  label: { width: 120 },
  value: { flex: 1 },
});
