import { useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { Dialog } from '@/design/components/Dialog';
import { Input } from '@/design/components/Input';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SettingRow } from '@/design/components/SettingRow';
import { TextArea } from '@/design/components/TextArea';
import { dimension } from '@/design/tokens';
import { getGetMeQueryKey, useGetAppStatus, useGetCities, useGetMe } from '@/lib/api/generated/engine';
import type { CityView, ProfileView } from '@/lib/api/generated/model';
import { t, tValue } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { CityPicker } from '../onboarding/CityPicker';
import { cityLabel } from '../onboarding/cities';
import { asApiError, errorText, patchMe } from '../onboarding/Onboarding';
import { PortraitGrid } from '../onboarding/PortraitGrid';
import { BIO_MAX } from '../onboarding/steps/About';
import { usePortraits } from '../onboarding/usePortraits';

type Field = 'name' | 'bio' | 'city';

export default function EditCharacter() {
  const profile = useGetMe().data?.profile;
  return profile ? <EditForm profile={profile} /> : null;
}

/**
 * Portraits are written as they change, like onboarding. Name, tale and city are a form: Save opens
 * once one differs from the account, writes only those, and leaving with changes unsaved asks first —
 * from the header arrow, Android's back button or a swipe alike.
 */
function EditForm({ profile }: { profile: ProfileView }) {
  const client = useQueryClient();
  const navigation = useNavigation();
  const app = useGetAppStatus().data;
  const cities = useGetCities().data;
  const portraits = usePortraits(app?.photosMax ?? 6);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ field: Field; text: string } | null>(null);
  const [leaving, setLeaving] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);

  const changed = {
    name: name.trim() !== profile.name ? name.trim() : null,
    bio: bio.trim() !== (profile.bio ?? '') ? bio.trim() : null,
    city: city !== profile.city ? city : null,
  };
  const dirty = Object.values(changed).some((v) => v !== null);

  usePreventRemove(dirty && !saved, ({ data }) => setLeaving(data.action));

  // Leave once the guard has seen the save: going back in the same tick would still be blocked.
  useEffect(() => {
    if (saved) router.back();
  }, [saved]);

  const save = async () => {
    if (!name.trim()) return setError({ field: 'name', text: t('onboarding.nameRequired') });
    if (!bio.trim()) return setError({ field: 'bio', text: t('onboarding.bioRequired') });
    setBusy(true);
    try {
      client.setQueryData(getGetMeQueryKey(), await patchMe(changed));
      setSaved(true);
    } catch (e) {
      const err = asApiError(e);
      const field: Field = err.code === 'profile.city' ? 'city' : err.code === 'profile.bio' ? 'bio' : 'name';
      setError({ field, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const edit = (field: Field, set: (s: string) => void) => (s: string) => {
    set(s);
    if (error?.field === field) setError(null);
  };
  const known = cities?.find((c) => c.name === city);
  const fieldError = (f: Field) => (error?.field === f ? error.text : null);

  return (
    <Scene
      header={<RoomHeader title={t('room.character')} onBack={router.back} />}
      footer={<Button block label={t('common.save')} onPress={save} disabled={!dirty} loading={busy} />}
    >
      <PortraitGrid portraits={portraits} max={app?.photosMax ?? 6} note={t('edit.photosHint')} />
      <Input
        label={t('onboarding.nameLabel')}
        value={name}
        onChangeText={edit('name', setName)}
        autoComplete="given-name"
        error={fieldError('name')}
      />
      <TextArea
        label={t('onboarding.aboutTitle')}
        value={bio}
        onChangeText={edit('bio', setBio)}
        maxLength={BIO_MAX}
        error={fieldError('bio')}
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
            error={fieldError('city')}
          />
        </View>
      </Pressable>
      {profile.gender ? (
        <Input
          label={t('edit.genderLabel')}
          value={t('edit.genderLocked', { gender: tValue('gender', profile.gender) })}
          onChangeText={() => {}}
          editable={false}
          disabled
        />
      ) : null}
      <View style={styles.deep}>
        <SettingRow
          glyph="mask"
          title={t('deep.title')}
          subtitle={t('deep.rowHint')}
          onPress={() => router.push('/deep')}
        />
      </View>

      <CityPicker
        open={picking}
        room={t('room.character')}
        selected={city}
        onClose={() => setPicking(false)}
        onPick={(c: CityView) => {
          setCity(c.name);
          if (error?.field === 'city') setError(null);
          setPicking(false);
        }}
      />
      <Dialog
        open={leaving !== null}
        title={t('edit.discardTitle')}
        body={t('edit.discardBody')}
        seal={false}
        confirm={{
          label: t('common.discard'),
          danger: true,
          onPress: () => {
            const action = leaving;
            setLeaving(null);
            if (action) navigation.dispatch(action);
          },
        }}
        cancel={{ label: t('common.cancel'), onPress: () => setLeaving(null) }}
      />
    </Scene>
  );
}

const styles = StyleSheet.create({
  // The row runs edge to edge, past the Scene's gutter.
  deep: { marginHorizontal: -dimension.sizeGutter },
});
