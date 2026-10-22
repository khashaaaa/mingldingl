import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OverlayHost } from '@/design/components/Overlay';
import { ToastHost } from '@/design/components/ToastHost';
import { FONTS } from '@/design/fonts';
import { useReduceMotionOverride } from '@/design/motion';
import { color } from '@/design/tokens';
import {
  getFireOverride,
  getSkyOverride,
  getSnowOverride,
  ROOMS,
  roomFor,
  type Sky,
  subscribeFire,
  subscribeSky,
  subscribeSnow,
} from '@/design/world/rooms';
import { WorldFloor } from '@/design/world/WorldFloor';
import { useGetSeason } from '@/lib/api/generated/engine';
import { BelongsProvider } from '@/lib/belongs';
import { devToolsEnabled, registerDevTools } from '@/lib/devTools';
import { loadSoundSetting } from '@/lib/feedback';
import { loadLocale } from '@/lib/i18n/device';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';
import { queryClient } from '@/lib/query';
import { initSentry } from '@/lib/sentry';
import { useGate, useLiveWhileSignedIn } from '@/lib/useGate';

initSentry();
loadSoundSetting();
loadLocale();
registerDevTools();
SplashScreen.preventAutoHideAsync().catch(() => {});

/** The World Floor shows through every navigator; iOS would otherwise paint the theme's grey behind screens. */
const NAV_THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={NAV_THEME}>
          <QueryClientProvider client={queryClient}>
            <OverlayHost>
              <Gate />
              <ToastHost />
            </OverlayHost>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Exactly one group is reachable at a time; when the answer changes the router moves the person. */
function Gate() {
  const [fontsLoaded] = useFonts(FONTS);
  const belongs = useGate();
  useLiveWhileSignedIn();
  const ready = fontsLoaded && belongs.group !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const segments = useSegments();
  const reduce = useReduceMotionOverride();
  const fireOverride = useSyncExternalStore(subscribeFire, getFireOverride);
  const skyOverride = useSyncExternalStore(subscribeSky, getSkyOverride);
  const snowOverride = useSyncExternalStore(subscribeSnow, getSnowOverride);
  // The festival running today tints the night (Figma World Floor, Season); in winter it snows.
  // Anonymous, so it loads alongside the session and fonts rather than after them.
  const season = useGetSeason().data;
  const festival = season?.now?.key as Sky | undefined;
  if (!ready) return null;
  const g = belongs.group;
  return (
    <BelongsProvider value={belongs}>
      <View style={{ flex: 1, backgroundColor: color.bgBase }}>
        <ReducedMotionConfig
          mode={reduce === null ? ReduceMotion.System : reduce ? ReduceMotion.Always : ReduceMotion.Never}
        />
        <WorldFloor
          fire={fireOverride ?? ROOMS[roomFor(segments)].fire}
          sky={skyOverride ?? festival ?? null}
          snow={snowOverride ?? season?.snow ?? false}
        />
        <Stack
          screenLayout={localeScreenLayout}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Protected guard={g === 'out'}>
            <Stack.Screen name="(out)" />
          </Stack.Protected>
          <Stack.Protected guard={g === 'closed'}>
            <Stack.Screen name="(closed)" />
          </Stack.Protected>
          <Stack.Protected guard={g === 'onboarding'}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={g === 'world'}>
            <Stack.Screen name="(world)" />
          </Stack.Protected>
          <Stack.Protected guard={devToolsEnabled()}>
            <Stack.Screen name="dev/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="dev/gallery" />
          </Stack.Protected>
        </Stack>
      </View>
    </BelongsProvider>
  );
}
