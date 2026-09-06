import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';

import { YesevaOne_400Regular } from '@expo-google-fonts/yeseva-one/400Regular';
import { Alegreya_400Regular } from '@expo-google-fonts/alegreya/400Regular';
import { Alegreya_500Medium } from '@expo-google-fonts/alegreya/500Medium';
import { Alegreya_700Bold } from '@expo-google-fonts/alegreya/700Bold';
import { AlegreyaSC_700Bold } from '@expo-google-fonts/alegreya-sc/700Bold';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useProfile } from '../hooks/useProfile';
import { useOptimisticScoreBump } from '../hooks/useOptimisticScoreBump';
import { queryClient } from '../lib/api/queryClient';
import { queryKeys } from '../lib/api/queryKeys';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { installGlobalErrorHandlers } from '../lib/globalErrorHandler';
import { NudgeToast } from '../components/modals/NudgeToast';
import { WorldProvider } from '../components/world/WorldProvider';
import { animationFor } from '../lib/world/travel';
import { getStoredSound } from '../lib/world/soundPreference';
import { useSoundStore } from '../store/soundStore';
import { useVfxLevel } from '../lib/vfx';
import { WorldFloor } from '../components/world/WorldFloor';
import { WorldCanopy } from '../components/world/WorldCanopy';
import { RewardToastHost } from '../components/RewardToastHost';
import { AlertModal } from '../components/modals/AlertModal';
import { GameButton } from '../components/ui/GameButton';
import { i18n } from '../lib/i18n';
import { wireFocusToAppState } from '../lib/appFocus';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRealtimeNudges } from '../hooks/useRealtimeNudges';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodicLocationRefresh } from '../hooks/usePeriodicLocationRefresh';
import { useTierThresholds } from '../hooks/useTierThresholds';
import { useRevealThresholds } from '../hooks/useRevealThresholds';
import { useSyncPreferredLocale } from '../hooks/useSyncPreferredLocale';
import { getStoredLocale } from '../lib/localePreference';
import { useLocaleStore } from '../store/localeStore';

installGlobalErrorHandlers();

/**
 * React Navigation paints `theme.colors.background` (#F2F2F2 by default) behind every navigator,
 * and `card` behind every screen. Both used to be invisible under each screen's own opaque ground;
 * with the screens transparent they sit on top of the world floor and turn the hold white. Setting
 * them transparent is what lets the floor reach the screen at all.
 */
const HOLD_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent', card: 'transparent' },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  splash: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
    paddingHorizontal: SPACE.xxxl,
  },
  splashTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: COLORS.text, textAlign: 'center' },
  splashBody: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center' },
  transparent: { backgroundColor: 'transparent' },
  webFrame: Platform.OS === 'web'
    ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }
    : { flex: 1 },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const setStreakBonusPending = useAuthStore((s) => s.setStreakBonusPending);
  const pendingNudge = useAuthStore((s) => s.pendingNudge);
  const setPendingNudge = useAuthStore((s) => s.setPendingNudge);
  const { data: userProfile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useProfile();
  const bumpScore = useOptimisticScoreBump();
  const isOnline = useNetworkStatus();
  const vfxLevel = useVfxLevel();
  useRealtimeNudges();
  usePushNotifications();
  usePeriodicLocationRefresh(!!userProfile);
  useTierThresholds();
  useRevealThresholds();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    YesevaOne_400Regular,
    Alegreya_400Regular, Alegreya_500Medium, Alegreya_700Bold, AlegreyaSC_700Bold,
    'CloisterBlack-Light': require('../assets/fonts/CloisterBlack.ttf'),
    ...MaterialCommunityIcons.font,
  });

  const [dailyLoginFailed, setDailyLoginFailed] = useState(false);
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  const [localeReady, setLocaleReady] = useState(false);
  useEffect(() => {
    getStoredLocale().then((stored) => {
      if (stored) useLocaleStore.getState().hydrate(stored);
      setLocaleReady(true);
    });
  }, []);

  const locale = useLocaleStore((s) => s.locale);
  useSyncPreferredLocale(locale, userProfile?.preferredLocale);

  useEffect(() => { setMounted(true); }, []);

  // Sound is off until someone turns it on, so this only ever restores a deliberate choice.
  useEffect(() => {
    getStoredSound().then((on) => useSoundStore.getState().hydrate(on));
  }, []);

  useEffect(() => wireFocusToAppState(), []);

  const [storeHydrated, setStoreHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setStoreHydrated(true));

    if (useAuthStore.persist.hasHydrated()) setStoreHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().clearSession();

        queryClient.clear();
        return;
      }
      if (!s) return;
      setSession(s);

      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
      try {
        const daily = await apiClient.scores.dailyLogin();
        if ((daily.awarded ?? 0) > 0) bumpScore(daily.awarded ?? 0);
        setStreakBonusPending(!!daily.streakBonusAwarded);
        queryClient.invalidateQueries({ queryKey: queryKeys.scoreDetail });
      } catch (err) {
        // Don't lose the daily award to one bad request — retry once the profile query settles.
        queryClient.invalidateQueries({ queryKey: queryKeys.scoreDetail });
        // A 404 here is the normal shape of a first sign-in: the number is claimed but the
        // account row is created by onboarding, so there is no score to award yet. Alerting on
        // it put "The Attempt Faltered" over the onboarding screen of every new user.
        if (isAxiosError(err) && err.response?.status === 404) return;
        setDailyLoginFailed(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mounted || !storeHydrated) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    if (!session) {
      if (!inAuth) router.replace('/(auth)/phone');
    } else if (profileLoading) {
      // Hold position until the profile query settles.
    } else if (profileError) {
      // Handled by the recovery screen below rather than by routing.
    } else if (!userProfile) {
      if (!inOnboarding) router.replace('/(onboarding)');
    } else {
      if (inAuth || inOnboarding) router.replace('/(tabs)/discover');
    }
  }, [mounted, storeHydrated, session, profileLoading, profileError, userProfile, segments]);

  if (!fontsReady || !localeReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  if (session && profileError && !userProfile) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>{i18n.t('profile_load_error_title')}</Text>
        <Text style={styles.splashBody}>{i18n.t('profile_load_error_body')}</Text>
        <GameButton variant="primary" onPress={() => refetchProfile()}>{i18n.t('retry')}</GameButton>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top']}>
        <WorldProvider>
        <View style={styles.webFrame}>
          {!isOnline && <OfflineBanner />}
          {/* Floor behind the navigator, canopy above it: screens still painting their own opaque
              background hide the floor but never the canopy, so the hold is lit either way. */}
          <WorldFloor />
          <ErrorBoundary>
            <ThemeProvider value={HOLD_THEME}>
            <Stack
              screenOptions={({ route }) => ({
                headerShown: false,
                animation: animationFor(route.name, vfxLevel !== 'full'),
                // Native stack screens take their ground from `contentStyle` rather than the
                // theme, so both are needed — see HOLD_THEME.
                contentStyle: styles.transparent,
              })}
            />
            </ThemeProvider>
          </ErrorBoundary>
          <WorldCanopy />
          <RewardToastHost />
          <AlertModal
            visible={dailyLoginFailed}
            tone="warning"
            title={i18n.t('action_failed_title')}
            message={i18n.t('action_failed_body')}
            onDismiss={() => setDailyLoginFailed(false)}
          />
          {pendingNudge && (
            <NudgeToast

              key={`${pendingNudge.matchId}:${pendingNudge.title}`}
              icon={pendingNudge.icon}
              title={pendingNudge.title}
              visible
              onDismiss={() => setPendingNudge(null)}
              onPress={() => {
                const matchId = pendingNudge.matchId;
                setPendingNudge(null);
                router.push(`/chat/${matchId}`);
              }}
            />
          )}
        </View>
        </WorldProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
