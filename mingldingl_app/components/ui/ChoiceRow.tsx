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

  unselectedVariant?: 'ghost' | 'brass';
}

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
