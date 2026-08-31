import * as SecureStore from 'expo-secure-store';

const KEY = 'locale-override';

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
