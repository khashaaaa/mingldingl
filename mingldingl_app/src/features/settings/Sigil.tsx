import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/design/components/Button';
import { Input } from '@/design/components/Input';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { isPhone } from '../auth/PhoneScreen';
import { Verify } from '../auth/VerifyScreen';
import { Scene } from '../common/Scene';

/** Change your sigil (Figma 35:547): the new number, then the same verify.mn proof as the Gate. */
export default function Sigil() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (!isPhone(phone)) return setError(t('phone.invalid'));
    router.push({ pathname: '/sigil-verify', params: { phone } });
  };

  return (
    <Scene
      header={<RoomHeader title={t('room.warRoom')} onBack={router.back} />}
      footer={<Button block label={t('common.continue')} onPress={next} />}
    >
      <Txt variant="displayL" engraved accessibilityRole="header">
        {t('sigil.title')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary">
        {t('sigil.body')}
      </Txt>
      <Input
        label={t('sigil.label')}
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
        // the number is the screen's only ask, so the keypad is already up
        autoFocus
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

/** The proof itself, under the War Room; once moved, back to the War Room with the new sigil shown. */
const MOVED = {
  kind: 'sigil',
  onMoved: () => {
    toast('info', t('sigil.moved'));
    router.dismissTo('/war-room');
  },
} as const;

export function SigilVerify({ phone }: { phone: string }) {
  return <Verify phone={phone} room={t('room.warRoom')} purpose={MOVED} />;
}
