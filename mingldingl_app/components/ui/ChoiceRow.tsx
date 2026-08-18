import { YStack, XStack, Text } from 'tamagui';
import { GameButton } from './GameButton';
import { COLORS, FONTS } from '../../lib/theme';

interface Props<T extends string> {
  label: string;
  value: T | null | undefined;
  options: readonly T[];
  optionLabel: (opt: T) => string;
  onChange: (opt: T) => void;
  size?: 'default' | 'compact';
  // Unselected-chip look. Defaults to the original flat 'ghost' chrome so
  // existing call sites (membership, edit-profile) are unaffected; settings
  // opts into the polished 'brass' look for its more compact rows.
  unselectedVariant?: 'ghost' | 'brass';
}

// Reusable label + wrapping row of tap-to-select chips — the same pattern
// NameAgeStep uses for gender, generalized for the deep profile fields
// (kids/smoking/drinking/religion/lifestyle), which range from 2 to 5
// options. Wraps rather than forcing equal flex per button, so it looks
// right at both ends of that range instead of cramming 5 options into one
// squeezed row.
export function ChoiceRow<T extends string>({
  label, value, options, optionLabel, onChange, size = 'default', unselectedVariant = 'ghost',
}: Props<T>) {
  return (
    <YStack gap="$2">
      <Text color={COLORS.textDim} fontSize={13} fontFamily={FONTS.body as any}>{label}</Text>
      <XStack gap="$2" flexWrap="wrap">
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
      </XStack>
    </YStack>
  );
}
