import { useRef, useState } from 'react';
import { Keyboard, TextInput, View, Text, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';
import { StepScaffold } from './StepScaffold';
import { FIELD_LIMITS } from '../../lib/fieldLimits';
import { GameButton } from '../ui/GameButton';
import { TextField } from '../ui/TextField';

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
      <View style={styles.container}>
        <Text style={styles.heading}>{i18n.t('who_are_you')}</Text>
        <TextField
          value={name} onChangeText={setName}
          placeholder={i18n.t('display_name_placeholder')}
          maxLength={FIELD_LIMITS.displayName}
          returnKeyType="next" onSubmitEditing={() => ageRef.current?.focus()} blurOnSubmit={false}
        />
        <TextField
          ref={ageRef} value={age} onChangeText={setAge}
          placeholder={i18n.t('age_placeholder')} keyboardType="number-pad"
          maxLength={2}
          returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
        />
        {showAgeError && (
          <Text style={styles.error}>{i18n.t('age_invalid')}</Text>
        )}
        <View style={styles.genderGroup}>
          <Text style={styles.label}>{i18n.t('gender')}</Text>
          <View style={styles.genderRow}>
            {(['Male', 'Female'] as const).map((g) => (
              <GameButton
                key={g} flex={1}
                variant={gender === g ? 'primary' : 'ghost'}
                onPress={() => { Keyboard.dismiss(); setGender(g); }}
              >
                {i18n.t(`gender_${g.toLowerCase()}`)}
              </GameButton>
            ))}
          </View>
        </View>
        <View style={styles.actions}>
          <GameButton
            variant="primary"
            disabled={!canNext}
            onPress={() => { Keyboard.dismiss(); onNext(name.trim(), ageNum, gender); }}
          >
            {i18n.t('next')}
          </GameButton>
        </View>
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACE.huge, gap: SPACE.lg },
  heading: { color: COLORS.text, fontSize: FONT_SIZES.title, fontFamily: FONTS.display },
  error: { color: COLORS.emberLight, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  genderGroup: { gap: SPACE.sm },
  label: { color: COLORS.textDim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  genderRow: { flexDirection: 'row', gap: SPACE.sm },
  actions: { marginTop: 'auto' },
});
