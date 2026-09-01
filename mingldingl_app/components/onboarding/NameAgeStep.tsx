import { useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { YStack, XStack, Text, Input } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { StepScaffold } from './StepScaffold';
import { FIELD_LIMITS } from '../../lib/fieldLimits';
import { GameButton } from '../ui/GameButton';

interface Props {
  initialName: string;
  initialAge: number;
  initialGender: string;
  onNext: (name: string, age: number, gender: string) => void;
}

export function NameAgeStep({ initialName, initialAge, initialGender, onNext }: Props) {
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState(initialAge > 0 ? String(initialAge) : '');
  const [gender, setGender] = useState(initialGender);
  // The engine caps age at [18, 99]; without this the whole flow completed and then failed with a
  // generic error three steps later, on a field the user could no longer see.
  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= FIELD_LIMITS.minAge && ageNum <= FIELD_LIMITS.maxAge;
  const showAgeError = age.length > 0 && !ageValid;
  const canNext = name.trim().length > 0 && ageValid && gender.length > 0;
  const ageRef = useRef<TextInput>(null);

  return (
    <StepScaffold>
      <YStack flex={1} padding="$6" gap="$4">
        <Text color={COLORS.text} fontSize={22} fontFamily={FONTS.display as any}>{i18n.t('who_are_you')}</Text>
        <Input
          value={name} onChangeText={setName}
          placeholder={i18n.t('display_name_placeholder')} placeholderTextColor={COLORS.textDim as any}
          maxLength={FIELD_LIMITS.displayName}
          backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
          fontFamily={FONTS.body as any}
          returnKeyType="next" onSubmitEditing={() => ageRef.current?.focus()} blurOnSubmit={false}
        />
        <Input
          ref={ageRef as any} value={age} onChangeText={setAge}
          placeholder={i18n.t('age_placeholder')} keyboardType="number-pad" placeholderTextColor={COLORS.textDim as any}
          maxLength={2}
          backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
          fontFamily={FONTS.body as any}
          returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
        />
        {showAgeError && (
          <Text color={COLORS.emberLight} fontSize={13} fontFamily={FONTS.body as any}>{i18n.t('age_invalid')}</Text>
        )}
        <YStack gap="$2">
          <Text color={COLORS.textDim} fontSize={13} fontFamily={FONTS.body as any}>{i18n.t('gender')}</Text>
          <XStack gap="$2">
            {(['Male', 'Female'] as const).map((g) => (
              <GameButton
                key={g} flex={1}
                variant={gender === g ? 'primary' : 'ghost'}
                onPress={() => { Keyboard.dismiss(); setGender(g); }}
              >
                {i18n.t(`gender_${g.toLowerCase()}`)}
              </GameButton>
            ))}
          </XStack>
        </YStack>
        <YStack marginTop="auto">
          <GameButton
            variant="primary"
            disabled={!canNext}
            onPress={() => { Keyboard.dismiss(); onNext(name.trim(), ageNum, gender); }}
          >
            {i18n.t('next')}
          </GameButton>
        </YStack>
      </YStack>
    </StepScaffold>
  );
}
