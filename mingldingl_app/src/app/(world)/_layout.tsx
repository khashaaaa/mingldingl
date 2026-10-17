import { Stack } from 'expo-router';
import { RestWatch } from '@/features/system/Rest';
import { WorldWatch } from '@/features/world/WorldWatch';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** A screen in the world that throws shows "The path falters" in its place. */
export { Fault as ErrorBoundary } from '@/features/system/Fault';

export default function WorldLayout() {
  return (
    <>
      <Stack
        screenLayout={localeScreenLayout}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      />
      <WorldWatch />
      <RestWatch />
    </>
  );
}
