import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, TextInput, View, Text, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';
import { StepScaffold } from './StepScaffold';
import { GameButton } from '../ui/GameButton';
import { TextField } from '../ui/TextField';
import { CityPickerModal } from '../modals/CityPickerModal';
import { useLocationCapture } from '../../hooks/useLocationCapture';
import { useGeoCities } from '../../hooks/useGeoCities';
import { apiClient } from '../../lib/api/apiClient';

interface Props {
  initialCity: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
  initialBio: string;
  onNext: (city: string, latitude: number | null, longitude: number | null, bio: string) => void;
  onBack: () => void;
}

export function AboutStep({ initialCity, initialLatitude, initialLongitude, initialBio, onNext, onBack }: Props) {
  const [city, setCity] = useState(initialCity);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [bio, setBio] = useState(initialBio);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const { capture, isCapturing, permissionDenied } = useLocationCapture();
  const { data: cities } = useGeoCities();
  const canNext = city.length > 0 && bio.trim().length > 0;
  const bioRef = useRef<TextInput>(null);

  useEffect(() => {
    if (city) return;
    (async () => {
      const coords = await capture();
      if (!coords) return;
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      try {
        const resolved = await apiClient.geo.nearestCity(coords.latitude, coords.longitude);
        setCity(resolved.city ?? '');
      } catch {
        setGeocodeFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePickCity(picked: string) {
    setCity(picked);
    setLatitude(null);
    setLongitude(null);
    setPickerVisible(false);
  }

  return (
    <StepScaffold>
      <View style={styles.container}>
        <Text style={{ color: COLORS.text, fontSize: FONT_SIZES.title, fontFamily: FONTS.display as any }}>{i18n.t('about_you')}</Text>

        {city ? (
          <View>
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, marginBottom: SPACE.xs }}>
              {i18n.t('your_area')}
            </Text>
            <Text style={{ color: COLORS.gold, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.xl }}>{city}</Text>
          </View>
        ) : isCapturing ? (
          <View style={styles.detecting}>
            <ActivityIndicator color={COLORS.gold} />
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.md }}>
              {i18n.t('detecting_location')}
            </Text>
          </View>
        ) : (permissionDenied || geocodeFailed) ? (
          <View style={styles.fallback}>
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.md }}>
              {i18n.t('location_permission_denied')}
            </Text>
            <GameButton variant="ghost" onPress={() => setPickerVisible(true)}>
              {i18n.t('choose_your_city')}
            </GameButton>
          </View>
        ) : null}

        <TextField
          ref={bioRef} value={bio} onChangeText={setBio}
          placeholder={i18n.t('bio_placeholder')} maxLength={200} multiline numberOfLines={4}
          returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit
        />
        <View style={styles.actions}>
          <GameButton variant="ghost" flex={1} onPress={() => { Keyboard.dismiss(); onBack(); }}>
            {i18n.t('back')}
          </GameButton>
          <GameButton
            variant="primary" flex={2}
            disabled={!canNext}
            onPress={() => { Keyboard.dismiss(); onNext(city, latitude, longitude, bio); }}
          >
            {i18n.t('next')}
          </GameButton>
        </View>
        <CityPickerModal
          visible={pickerVisible}
          provinces={cities?.provinces ?? []}
          ulaanbaatarDistricts={cities?.ulaanbaatarDistricts ?? []}
          onSelect={handlePickCity}
          onDismiss={() => setPickerVisible(false)}
        />
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACE.huge, gap: SPACE.lg },
  detecting: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  fallback: { gap: SPACE.sm },
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: 'auto' },
});
