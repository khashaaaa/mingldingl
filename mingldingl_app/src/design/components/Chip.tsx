import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { color } from '../tokens';
import { Txt } from './Txt';

/**
 * A small framed tag with a dot (Figma Chip). Lit (gold) or quiet (iron). With onPress it is one
 * of a row of exclusive choices — the Guild House's "how long".
 */
export function Chip({ label, lit, onPress }: { label: string; lit: boolean; onPress?: () => void }) {
  const body = (
    <View style={[styles.chip, { borderColor: lit ? color.borderGold : color.borderStrong }]}>
      <View style={[styles.dot, { backgroundColor: lit ? color.borderGold : color.borderStrong }]} />
      <Txt variant="labelS" color={lit ? 'accentGoldBright' : 'textSecondary'}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: lit }}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      hitSlop={6}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
