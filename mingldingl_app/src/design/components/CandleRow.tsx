import { StyleSheet, View } from 'react-native';
import { dimension } from '../tokens';
import { Art } from './Art';
import { Txt } from './Txt';

/** Tonight's summons as candles: lit ones left, spent stubs used (Figma 26:3, 26:19). */
export function CandleRow({
  left,
  total,
  label,
  size = 'small',
}: {
  left: number;
  total: number;
  label: string;
  /** large: the Hearth's row (24×72). */
  size?: 'small' | 'large';
}) {
  const shown = Math.min(total, 12);
  // The Hearth's tall candles hold up to nine across; more than that and they burn at Seek's size.
  const big = size === 'large' && shown <= 9;
  return (
    <View accessible accessibilityLabel={label} style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: shown }, (_, i) => (
          <Art
            // biome-ignore lint/suspicious/noArrayIndexKey: candles have no identity but their place
            key={i}
            name={i < left ? 'candle_lit' : 'candle_spent'}
            style={big ? styles.large : styles.candle}
            fit="contain"
          />
        ))}
      </View>
      <Txt variant="labelS" color="textMuted">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: dimension.space2 },
  row: { flexDirection: 'row', gap: dimension.space3, alignItems: 'flex-end' },
  candle: { width: 17, height: 50 },
  large: { width: 24, height: 72 },
});
