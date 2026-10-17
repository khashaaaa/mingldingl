import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Button } from '@/design/components/Button';
import { Input } from '@/design/components/Input';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/** The engine takes the eight national digits; +976 is shown, never typed. */
export const isPhone = (s: string) => /^\d{8}$/.test(s);

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The number is the screen's only ask: the keypad is up on arrival and on coming back from Verify.
  const field = useRef<TextInput>(null);
  useFocusEffect(
    useCallback(() => {
      // after the slide-in: Android focuses the field but keeps the keypad down if it is asked mid-transition
      const timer = setTimeout(() => field.current?.focus(), 350);
      return () => clearTimeout(timer);
    }, []),
  );

  const next = () => {
    if (!isPhone(phone)) return setError(t('phone.invalid'));
    router.push({ pathname: '/verify', params: { phone } });
  };

  return (
    <Scene
      header={<RoomHeader title={t('room.gate')} onBack={router.back} />}
      footer={<Button block label={t('common.continue')} onPress={next} />}
    >
      <Txt variant="displayL" engraved accessibilityRole="header">
        {t('phone.title')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary">
        {t('phone.why')}
      </Txt>
      <Input
        label={t('phone.label')}
        prefix="+976"
        value={phone}
        onChangeText={(s) => {
          setPhone(s.replace(/\D/g, '').slice(0, 8));
          setError(null);
        }}
        placeholder={t('phone.placeholder')}
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel-national"
        ref={field}
        maxLength={8}
        returnKeyType="next"
        onSubmitEditing={next}
        error={error}
      />
      <Txt variant="bodyS" color="textMuted">
        {t('phone.cost')}
      </Txt>
    </Scene>
  );
}
