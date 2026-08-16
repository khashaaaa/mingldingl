import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
// Deep per-weight imports, not the package's barrel index — that index.js
// unconditionally require()s all 12 (Alegreya) weight files, so importing
// even one named export from it makes Metro bundle every weight regardless
// of which ones are actually used. These subpaths each have their own
// index.js requiring only their own .ttf (~2.5MB saved).
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
import { installGlobalErrorHandlers } from '../lib/globalErrorHandler';
import { NudgeToast } from '../components/modals/NudgeToast';
import { useRealtimeNudges } from '../hooks/useRealtimeNudges';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodicLocationRefresh } from '../hooks/usePeriodicLocationRefresh';
import { useTierThresholds } from '../hooks/useTierThresholds';
import { getStoredLocale } from '../lib/localePreference';
import { useLocaleStore } from '../store/localeStore';

// Module-scope, not inside the component: runs exactly once when the JS
// bundle loads, before any screen mounts or any onPress fires.
installGlobalErrorHandlers();

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  // This is a mobile-first layout with no per-screen width constraints, so on
  // a real desktop browser (this app also runs on web) every card/button
  // stretches to fill the window. Letterbox it to a phone-like column instead
  // — native builds are already phone-width, so this is a no-op there.
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
  // Safety valve: never block the app more than 3s on font loading
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  // A manually-picked language (Settings screen) overrides i18n.ts's
  // device-locale default. Read once before first paint, then handed to
  // localeStore so later changes (Settings screen) re-render live instead
  // of requiring a restart.
  const [localeReady, setLocaleReady] = useState(false);
  useEffect(() => {
    getStoredLocale().then((stored) => {
      if (stored) useLocaleStore.getState().hydrate(stored);
      setLocaleReady(true);
    });
  }, []);
  // Subscribing here (return value unused, same idiom as useRealtimeNudges()
  // etc. below) makes AppContent re-render whenever localeStore.setLocale()
  // runs, cascading through every mounted screen since nothing in this app
  // uses React.memo.
  useLocaleStore((s) => s.locale);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        try {
          // apiClient.users.me() is no longer fetched here — useProfile()
          // fires on its own once `session` is set (enabled: !!session).
          const daily = await apiClient.scores.dailyLogin();
          if ((daily.awarded ?? 0) > 0) bumpScore(daily.awarded ?? 0);
          setStreakBonusPending(!!daily.streakBonusAwarded);
          queryClient.invalidateQueries({ queryKey: queryKeys.scoreDetail });
        } catch {
          // API unavailable — the profile/score queries will show their own error state
        }
      } else {
        // Actual sign-out: wipe all cached data (profile/score/matches/etc.) so
        // a different account signing in on the same device never sees stale data.
        queryClient.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    if (!session) {
      if (!inAuth) router.replace('/(auth)/phone');
    } else if (profileLoading) {
      // still determining whether this session has a profile — don't route yet
    } else if (profileError) {
      // /users/me failed for a reason other than "no profile yet" (network,
      // 5xx) — stay put rather than routing into onboarding, which would
      // re-fill and overwrite an existing profile once the real cause is
      // just a transient fetch failure. React Query's default retries will
      // resolve this once the request actually succeeds.
    } else if (!userProfile) {
      if (!inOnboarding) router.replace('/(onboarding)');
    } else {
      if (inAuth || inOnboarding) router.replace('/(tabs)/discover');
    }
  }, [mounted, session, profileLoading, profileError, userProfile, segments]);

  if (!fontsReady || !localeReady) return null;

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <SafeAreaView style={styles.root} edges={['top']}>
          <View style={styles.webFrame}>
            <ErrorBoundary>
              {/* Stack, not Slot: Slot swaps the whole matched route out on
                  every navigation, so pushing a standalone screen (e.g.
                  /business/[id]) from inside (tabs) unmounted the tabs
                  navigator entirely — going back then remounted it fresh,
                  landing on its first tab instead of the one the player was
                  actually on. Stack keeps (tabs) mounted underneath and
                  just pushes/pops screens on top of it, the same as every
                  nested group layout in this app already does. */}
              <Stack screenOptions={{ headerShown: false }} />
            </ErrorBoundary>
            {pendingNudge && (
              <NudgeToast
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
