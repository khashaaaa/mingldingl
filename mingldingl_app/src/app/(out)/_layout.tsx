import { Stack } from 'expo-router';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';

export default function OutLayout() {
  return (
    <Stack
      screenLayout={localeScreenLayout}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    />
  );
}
