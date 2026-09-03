import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '../hooks/useProfile';
import { useLocationCapture } from '../hooks/useLocationCapture';
import { useGeoCities } from '../hooks/useGeoCities';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../lib/theme';
import { FIELD_LIMITS } from '../lib/fieldLimits';
import { DismissKeyboardView } from '../components/ui/DismissKeyboardView';
import { AppCard } from '../components/ui/AppCard';
import { GameButton } from '../components/ui/GameButton';
import { ChoiceRow } from '../components/ui/ChoiceRow';
import { CityPickerModal } from '../components/modals/CityPickerModal';
import { PhotoGrid } from '../components/PhotoGrid';
import { SectionDivider } from '../components/ui/SectionDivider';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { TextField } from '../components/ui/TextField';
import { TiledBackdrop } from '../components/ui/TiledBackdrop';

const SMOKING_DRINKING_OPTIONS = ['Never', 'Occasionally', 'Regularly'] as const;
const RELIGION_OPTIONS = ['Buddhist', 'Christian', 'Muslim', 'None', 'Other'] as const;
const LIFESTYLE_OPTIONS = ['Active', 'Balanced', 'Relaxed'] as const;
const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

export default function EditProfileScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(profile?.photoUrls ?? []);
  const [hasKids, setHasKids] = useState<boolean | null>(profile?.hasKids ?? null);
  const [smokingHabit, setSmokingHabit] = useState(profile?.smokingHabit ?? '');
  const [drinkingHabit, setDrinkingHabit] = useState(profile?.drinkingHabit ?? '');
  const [religion, setReligion] = useState(profile?.religion ?? '');
  const [lifestyle, setLifestyle] = useState(profile?.lifestyle ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bioRef = useRef<TextInput>(null);
  const { capture, isCapturing, permissionDenied } = useLocationCapture();
  const { data: cities } = useGeoCities();

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    setDisplayName(profile.displayName ?? '');
    setBio(profile.bio ?? '');
    setPhotoUrls(profile.photoUrls ?? []);
    setHasKids(profile.hasKids ?? null);
    setSmokingHabit(profile.smokingHabit ?? '');
    setDrinkingHabit(profile.drinkingHabit ?? '');
    setReligion(profile.religion ?? '');
    setLifestyle(profile.lifestyle ?? '');
    setCity(profile.city ?? '');
  }, [profile]);

  // `photoUrls` carries local file:// placeholders until their upload resolves, so saving mid-upload
  // would persist one of those as a photo URL.
  const canSave = displayName.trim().length > 0 && photoUrls.length >= 3 && !saving && !photosUploading;

  async function handleRefreshLocation() {
    const coords = await capture();
    if (!coords) return;
    try {
      const result = await apiClient.users.updateLocation(coords.latitude, coords.longitude);
      setCity(result.city ?? '');
      queryClient.setQueryData(queryKeys.userProfile, (prev: ReturnType<typeof parseUserProfile> | undefined) =>
        prev ? { ...prev, city: result.city ?? prev.city } : prev);
    } catch {
      setError(i18n.t('save_error'));
    }
  }

  async function handlePickCityManually(picked: string) {
    const previousCity = city;
    setCity(picked);
    setCityPickerVisible(false);
    try {
      const updated = await apiClient.users.update({ city: picked });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
    } catch {
      setCity(previousCity);
      setError(i18n.t('save_error'));
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.users.update({
        displayName,
        bio,
        photoUrls,
        hasKids,
        smokingHabit: smokingHabit || null,
        drinkingHabit: drinkingHabit || null,
        religion: religion || null,
        lifestyle: lifestyle || null,
      });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
      router.back();
    } catch {
      setError(i18n.t('save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DismissKeyboardView>
      <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={i18n.t('edit_profile')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.gutter, paddingVertical: SPACE.xxl, gap: SPACE.lg }}>
        <AppCard textured style={{ padding: SPACE.lg }}>
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t('your_photos')}</Text>
            <PhotoGrid photoUrls={photoUrls} onChange={setPhotoUrls} onUploadingChange={setPhotosUploading} />
            <Text style={[styles.hint, { color: photoUrls.length >= 3 ? COLORS.goldBright : COLORS.gold }]}>
              {i18n.t('photos_minimum', { n: photoUrls.length })}
            </Text>
          </View>
        </AppCard>

        <AppCard textured style={{ padding: SPACE.lg }}>
          <View style={styles.cardBodyLoose}>
            <TextField
              value={displayName} onChangeText={setDisplayName}
              placeholder={i18n.t('display_name_placeholder')}
              maxLength={FIELD_LIMITS.displayName}
              returnKeyType="next" onSubmitEditing={() => bioRef.current?.focus()} blurOnSubmit={false}
            />
            <TextField
              ref={bioRef} value={bio} onChangeText={setBio}
              placeholder={i18n.t('bio_placeholder')} maxLength={200} multiline numberOfLines={4}
              returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit
            />
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        </AppCard>

        <AppCard textured style={{ padding: SPACE.lg }}>
          <View style={styles.cardBodyLoose}>
            <View style={styles.titleBlock}>
              <Text style={styles.sectionTitle}>{i18n.t('deep_profile_title')}</Text>
              <Text style={styles.hint}>{i18n.t('deep_profile_hint')}</Text>
            </View>
            <SectionDivider />
            <ChoiceRow
              label={i18n.t('has_kids')}
              value={hasKids === null ? null : hasKids ? 'yes' : 'no'}
              options={['yes', 'no'] as const}
              optionLabel={(opt) => i18n.t(opt === 'yes' ? 'has_kids_yes' : 'has_kids_no')}
              onChange={(opt) => setHasKids(opt === 'yes')}
              size="compact"
            />
            <ChoiceRow
              label={i18n.t('smoking_habit')}
              value={smokingHabit as (typeof SMOKING_DRINKING_OPTIONS)[number] | ''}
              options={SMOKING_DRINKING_OPTIONS}
              optionLabel={(opt) => i18n.t(`habit_${opt.toLowerCase()}`)}
              onChange={setSmokingHabit}
              size="compact"
            />
            <ChoiceRow
              label={i18n.t('drinking_habit')}
              value={drinkingHabit as (typeof SMOKING_DRINKING_OPTIONS)[number] | ''}
              options={SMOKING_DRINKING_OPTIONS}
              optionLabel={(opt) => i18n.t(`habit_${opt.toLowerCase()}`)}
              onChange={setDrinkingHabit}
              size="compact"
            />
            <ChoiceRow
              label={i18n.t('religion')}
              value={religion as (typeof RELIGION_OPTIONS)[number] | ''}
              options={RELIGION_OPTIONS}
              optionLabel={(opt) => i18n.t(`religion_${opt.toLowerCase()}`)}
              onChange={setReligion}
              size="compact"
            />
            <ChoiceRow
              label={i18n.t('lifestyle')}
              value={lifestyle as (typeof LIFESTYLE_OPTIONS)[number] | ''}
              options={LIFESTYLE_OPTIONS}
              optionLabel={(opt) => i18n.t(`lifestyle_${opt.toLowerCase()}`)}
              onChange={setLifestyle}
              size="compact"
            />
          </View>
        </AppCard>

        <AppCard textured style={{ padding: SPACE.lg }}>
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t('your_area')}</Text>
            {isCapturing ? (
              <View style={styles.locatingRow}>
                <ActivityIndicator color={COLORS.gold} size="small" />
                <Text style={styles.hint}>
                  {i18n.t('detecting_location')}
                </Text>
              </View>
            ) : (
              <Text style={styles.city}>{city || '—'}</Text>
            )}
            <GameButton variant="brass" size="compact" icon="crosshairs-gps" loading={isCapturing} onPress={handleRefreshLocation}>
              {i18n.t('refresh_location')}
            </GameButton>
            {error && <Text style={styles.error}>{error}</Text>}
            {permissionDenied && (
              <View style={styles.deniedBlock}>
                <Text style={styles.hint}>
                  {i18n.t('location_permission_denied')}
                </Text>
                <GameButton variant="brass" size="compact" onPress={() => setCityPickerVisible(true)}>
                  {i18n.t('choose_your_city')}
                </GameButton>
              </View>
            )}
          </View>
        </AppCard>
      </ScrollView>

      <CityPickerModal
        visible={cityPickerVisible}
        provinces={cities?.provinces ?? []}
        ulaanbaatarDistricts={cities?.ulaanbaatarDistricts ?? []}
        onSelect={handlePickCityManually}
        onDismiss={() => setCityPickerVisible(false)}
      />

      <View style={styles.footer}>
        <GameButton variant="brass" size="compact" flex={1} onPress={() => { Keyboard.dismiss(); router.back(); }}>
          {i18n.t('back')}
        </GameButton>
        <GameButton
          variant="primary" size="compact" flex={2}
          disabled={!canSave} loading={saving}
          onPress={() => { Keyboard.dismiss(); handleSave(); }}
        >
          {i18n.t('save')}
        </GameButton>
      </View>
      </View>
    </DismissKeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  cardBody: { gap: SPACE.md, zIndex: 1 },
  cardBodyLoose: { gap: SPACE.lg, zIndex: 1 },
  titleBlock: { gap: SPACE.hair },
  locatingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  deniedBlock: { gap: SPACE.sm },
  footer: { flexDirection: 'row', gap: SPACE.md, padding: SPACE.huge, paddingTop: SPACE.md },
  sectionTitle: { color: COLORS.gold, fontSize: FONT_SIZES.md, fontFamily: FONTS.bodyBold },
  hint: { color: COLORS.textDim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  error: { color: COLORS.emberLight, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  city: { color: COLORS.text, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold },
});
