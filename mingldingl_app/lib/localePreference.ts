import * as SecureStore from 'expo-secure-store';

const KEY = 'locale-override';

// Manual language switch (Settings screen) vs. i18n.ts's device-locale
// default. Read once at boot to seed store/localeStore.ts (see
// app/_layout.tsx's localeReady gate); store/localeStore.ts's setLocale()
// writes back through here on every later change.
export async function getStoredLocale(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setStoredLocale(locale: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, locale);
}
