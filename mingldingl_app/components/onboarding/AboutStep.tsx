import { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput, View, Text } from 'react-native';
import { YStack, XStack, TextArea, Spinner } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { DismissKeyboardView } from '../ui/DismissKeyboardView';
import { GameButton } from '../ui/GameButton';
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
  const canNext = city.length > 0 && bio.length > 0;
  const bioRef = useRef<TextInput>(null);

  useEffect(() => {
    // Already resolved (e.g. the user went back to NameAgeStep and returned
    // here) — don't re-fire GPS capture and possibly overwrite a manual
    // fallback pick with a fresh detection.
    if (city) return;
    (async () => {
      const coords = await capture();
      if (!coords) return; // permissionDenied flips true; fallback picker button shows instead
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
    <DismissKeyboardView>
      <YStack flex={1} padding="$6" gap="$4">
        <Text style={{ color: COLORS.text, fontSize: 22, fontFamily: FONTS.display as any }}>{i18n.t('about_you')}</Text>

        {city ? (
          <View>
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 12, marginBottom: 4 }}>
              {i18n.t('your_area')}
            </Text>
            <Text style={{ color: COLORS.gold, fontFamily: FONTS.bodyBold, fontSize: 17 }}>{city}</Text>
          </View>
        ) : isCapturing ? (
          <XStack alignItems="center" gap="$2">
            <Spinner color="$gold" />
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 14 }}>
              {i18n.t('detecting_location')}
            </Text>
          </XStack>
        ) : (permissionDenied || geocodeFailed) ? (
          <YStack gap="$2">
            <Text style={{ color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 13 }}>
              {i18n.t('location_permission_denied')}
            </Text>
            <GameButton variant="ghost" onPress={() => setPickerVisible(true)}>
              {i18n.t('choose_your_city')}
            </GameButton>
          </YStack>
        ) : null}

        <TextArea
          ref={bioRef as any} value={bio} onChangeText={setBio}
          placeholder={i18n.t('bio_placeholder')} maxLength={200} numberOfLines={4}
          backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
          fontFamily={FONTS.body as any}
          placeholderTextColor={COLORS.textDim as any}
          returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit
        />
        <XStack gap="$3" marginTop="auto">
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
        </XStack>
        <CityPickerModal
          visible={pickerVisible}
          provinces={cities?.provinces ?? []}
          ulaanbaatarDistricts={cities?.ulaanbaatarDistricts ?? []}
          onSelect={handlePickCity}
          onDismiss={() => setPickerVisible(false)}
        />
      </YStack>
    </DismissKeyboardView>
  );
}
