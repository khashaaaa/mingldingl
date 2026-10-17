import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { Input } from '@/design/components/Input';
import { TextArea } from '@/design/components/TextArea';
import { useGetCities } from '@/lib/api/generated/engine';
import type { CityView } from '@/lib/api/generated/model';
import { t } from '@/lib/i18n';
import { CityPicker } from '../CityPicker';
import { cityLabel } from '../cities';
import { errorText, patchMe, StepScene, useDraft, useOnboarding } from '../Onboarding';

export const BIO_MAX = 300;

/** Step 4. A few lines in the person's own words and the place they live, written together. */
export default function About() {
  const { me, advance } = useOnboarding();
  const cities = useGetCities().data;
  const [bio, setBio] = useDraft('bio', me.profile?.bio ?? '');
  const [city, setCity] = useDraft<string | null>('city', me.profile?.city ?? null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'bio' | 'city'; text: string } | null>(null);

  const known = cities?.find((c) => c.name === city);
  const next = async () => {
    if (!bio.trim()) return setError({ field: 'bio', text: t('onboarding.bioRequired') });
    if (!city) return setError({ field: 'city', text: t('onboarding.cityRequired') });
    setBusy(true);
    const e = await advance(() => patchMe({ bio: bio.trim(), city }));
    setBusy(false);
    if (e) setError({ field: e.code === 'profile.city' ? 'city' : 'bio', text: errorText(e) });
  };

  return (
    <StepScene
      title={t('onboarding.aboutTitle')}
      hint={t('onboarding.aboutHint')}
      footer={<Button block label={t('common.continue')} onPress={next} loading={busy} />}
    >
      <TextArea
        label={t('onboarding.aboutTitle')}
        value={bio}
        onChangeText={(s) => {
          setBio(s);
          setError(null);
        }}
        maxLength={BIO_MAX}
        error={error?.field === 'bio' ? error.text : null}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.cityLabel')}
        accessibilityValue={{ text: known ? cityLabel(known) : (city ?? '') }}
        onPress={() => setPicking(true)}
      >
        <View pointerEvents="none">
          <Input
            label={t('onboarding.cityLabel')}
            value={known ? cityLabel(known) : (city ?? '')}
            onChangeText={() => {}}
            placeholder={t('city.title')}
            editable={false}
            error={error?.field === 'city' ? error.text : null}
          />
        </View>
      </Pressable>
      <CityPicker
        open={picking}
        room={t('room.gate')}
        selected={city}
        onClose={() => setPicking(false)}
        onPick={(c: CityView) => {
          setCity(c.name);
          setError(null);
          setPicking(false);
        }}
      />
    </StepScene>
  );
}
