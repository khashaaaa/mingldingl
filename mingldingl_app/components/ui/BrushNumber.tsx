import { Image, Text, View, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useCountedValue } from './CountText';
import { BRUSH_DIGITS, BRUSH_DIGIT_PAD } from './brushImages';
import { FONTS } from '../../lib/theme';

interface Props {
  value: number;
  /** How tall the ink of a numeral stands, in points (a cap height, not a line height). */
  size: number;
  color: string;
  format?: (n: number) => string;
  /** Tick from the old number to the new one, as `CountText` does. */
  tick?: boolean;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
}

const defaultFormat = (n: number) => n.toLocaleString('en-US');
/** Brushed numerals overlap a hair, the way a hand writes a number without lifting far. */
const KERN = 0.06;

/**
 * A number painted rather than set: each numeral one dry-brush stroke (`scripts/gen-brush.js`),
 * two hands of each alternating along the number so a repeated digit is never the same stamp.
 * For the few numbers that are the point of what they sit in — the score, a streak. Anything that
 * is not a numeral or a comma falls back to the display face.
 */
export function BrushNumber({ value, size, color, format = defaultFormat, tick = true, style, onLayout, testID }: Props) {
  const counted = useCountedValue(value);
  const shown = tick ? counted : value;
  const height = size / (1 - BRUSH_DIGIT_PAD * 2);
  return (
    <View
      style={[styles.row, { height: size, paddingHorizontal: height * KERN }, style]}
      onLayout={onLayout}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={format(Math.round(value))}
    >
      {[...format(shown)].map((ch, i) => {
        const glyph = BRUSH_DIGITS[ch === ',' ? ',' : `${ch}-${i % 2}`];
        if (!glyph) return <Text key={i} style={[styles.fallback, { color, fontSize: size * 1.2 }]}>{ch}</Text>;
        return (
          <Image
            key={i}
            source={glyph.source}
            accessible={false}
            style={{ width: height * glyph.aspect, height, tintColor: color, marginHorizontal: -height * KERN, marginVertical: -(height - size) / 2 }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  fallback: { fontFamily: FONTS.display },
});
