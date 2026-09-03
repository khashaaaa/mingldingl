import { View, Text, StyleSheet } from 'react-native';
import { GameButton } from './GameButton';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';

interface Props<T extends string> {
  label: string;
  value: T | null | undefined;
  options: readonly T[];
  optionLabel: (opt: T) => string;
  onChange: (opt: T) => void;
  size?: 'default' | 'compact';

  unselectedVariant?: 'ghost' | 'brass';
}

export function ChoiceRow<T extends string>({
  label, value, options, optionLabel, onChange, size = 'default', unselectedVariant = 'ghost',
}: Props<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((opt) => (
          <GameButton
            key={opt}
            variant={value === opt ? 'primary' : unselectedVariant}
            size={size}
            onPress={() => onChange(opt)}
          >
            {optionLabel(opt)}
          </GameButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACE.sm },
  label: { color: COLORS.textDim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  options: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' },
});
