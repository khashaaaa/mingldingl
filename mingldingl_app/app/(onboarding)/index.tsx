import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useAuth } from '../../hooks/useAuth';
import { NameAgeStep } from '../../components/onboarding/NameAgeStep';
import { AboutStep } from '../../components/onboarding/AboutStep';
import { PhotosStep } from '../../components/onboarding/PhotosStep';
import { OathStep } from '../../components/onboarding/OathStep';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { COLORS, FONTS, FONT_SIZES, SPACE, circle } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

const STEP_COUNT = 4;

export default function OnboardingScreen() {
  useLocaleStore((s) => s.locale);
  const { state, update, updatePhotos, nextStep, prevStep, submit } = useOnboarding();
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZES.xl,
          color: COLORS.gold,
          textAlign: 'center',
          letterSpacing: 1.5,
          paddingTop: SPACE.md,
        }}
      >
        {i18n.t('create_character')}
      </Text>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.dotsRow}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i <= state.currentStep ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity onPress={signOut} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.signOutLink}>{i18n.t('sign_out')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.stepLabel}>
          {i18n.t('step_of', { n: state.currentStep + 1, total: STEP_COUNT })}
        </Text>
      </View>

      {state.currentStep === 0 && (
        <NameAgeStep
          initialName={state.displayName}
          initialAge={state.age}
          initialGender={state.gender}
          onNext={(name, age, gender) => { update({ displayName: name, age, gender }); nextStep(); }}
        />
      )}
      {state.currentStep === 1 && (
        <AboutStep
          initialCity={state.city}
          initialLatitude={state.latitude}
          initialLongitude={state.longitude}
          initialBio={state.bio}
          onNext={(city, latitude, longitude, bio) => { update({ city, latitude, longitude, bio }); nextStep(); }}
          onBack={prevStep}
        />
      )}
      {state.currentStep === 2 && (
        <PhotosStep
          photoUrls={state.photoUrls}
          onPhotosChange={updatePhotos}
          referralCode={state.referralCode}
          onReferralCodeChange={(code) => update({ referralCode: code })}
          onNext={nextStep}
          onBack={prevStep}
        />
      )}
      {state.currentStep === 3 && (
        <OathStep
          initialOath={state.oath}
          loading={state.loading}
          error={state.error}
          onSubmit={(oath) => { update({ oath }); submit(oath); }}
          onBack={prevStep}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: SPACE.gutter,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    gap: SPACE.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
    alignItems: 'center',
  },
  signOutLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textDim,
    letterSpacing: 0.3,
    fontFamily: FONTS.body,
    textDecorationLine: 'underline',
  },
  dot: circle(10),
  dotActive: {
    backgroundColor: COLORS.gold,
  },
  dotInactive: {
    backgroundColor: COLORS.bronze,
  },
  stepLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textDim,
    letterSpacing: 0.3,
    fontFamily: FONTS.body,
  },
});
