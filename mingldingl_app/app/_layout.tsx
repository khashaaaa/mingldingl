import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';

import { YesevaOne_400Regular } from '@expo-google-fonts/yeseva-one/400Regular';
import { Alegreya_400Regular } from '@expo-google-fonts/alegreya/400Regular';
import { Alegreya_500Medium } from '@expo-google-fonts/alegreya/500Medium';
import { Alegreya_700Bold } from '@expo-google-fonts/alegreya/700Bold';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useProfile } from '../hooks/useProfile';
import { useOptimisticScoreBump } from '../hooks/useOptimisticScoreBump';
import tamaguiConfig from '../tamagui.config';
import { queryClient } from '../lib/api/queryClient';
import { queryKeys } from '../lib/api/queryKeys';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { COLORS } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { installGlobalErrorHandlers } from '../lib/globalErrorHandler';
import { NudgeToast } from '../components/modals/NudgeToast';
import { RewardToastHost } from '../components/RewardToastHost';
import { wireFocusToAppState } from '../lib/appFocus';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRealtimeNudges } from '../hooks/useRealtimeNudges';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodicLocationRefresh } from '../hooks/usePeriodicLocationRefresh';
import { useTierThresholds } from '../hooks/useTierThresholds';
import { getStoredLocale } from '../lib/localePreference';
import { useLocaleStore } from '../store/localeStore';

installGlobalErrorHandlers();

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
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
  const { data: userProfile, isLoading: profileLoading, isError: profileError } = useProfile();
  const bumpScore = useOptimisticScoreBump();
  const isOnline = useNetworkStatus();
  useRealtimeNudges();
  usePushNotifications();
  usePeriodicLocationRefresh(!!userProfile);
  useTierThresholds();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    YesevaOne_400Regular,
    Alegreya_400Regular, Alegreya_500Medium, Alegreya_700Bold,
    'CloisterBlack-Light': require('../assets/fonts/CloisterBlack.ttf'),
    ...MaterialCommunityIcons.font,
  });

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

  useLocaleStore((s) => s.locale);

  useEffect(() => { setMounted(true); }, []);

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
      } catch {
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
    } else if (profileError) {
    } else if (!userProfile) {
      if (!inOnboarding) router.replace('/(onboarding)');
    } else {
      if (inAuth || inOnboarding) router.replace('/(tabs)/discover');
    }
  }, [mounted, storeHydrated, session, profileLoading, profileError, userProfile, segments]);

  if (!fontsReady || !localeReady) return null;

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <SafeAreaView style={styles.root} edges={['top']}>
          <View style={styles.webFrame}>
            {!isOnline && <OfflineBanner />}
            <ErrorBoundary>
              <Stack screenOptions={{ headerShown: false }} />
            </ErrorBoundary>
            <RewardToastHost />
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
        </SafeAreaView>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
