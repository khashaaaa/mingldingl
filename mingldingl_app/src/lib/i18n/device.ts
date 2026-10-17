import * as SecureStore from 'expo-secure-store';
import { type Locale, setLocale } from './index';

export const LOCALE_KEY = 'mingl.locale';

/**
 * The language chosen at the Gate, kept on the device so it holds before anyone signs in. Account
 * creation copies it onto the profile; after that the profile's locale is the one that travels.
 */
export async function loadLocale() {
  const saved = await SecureStore.getItemAsync(LOCALE_KEY).catch(() => null);
  if (saved === 'en' || saved === 'mn') setLocale(saved);
}

export async function chooseLocale(l: Exclude<Locale, 'pseudo'>) {
  setLocale(l);
  await SecureStore.setItemAsync(LOCALE_KEY, l).catch(() => {});
}
