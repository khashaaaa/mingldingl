import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './en';
import { mn } from './mn';

export const translations = { en, mn };

export const i18n = new I18n(translations);
i18n.locale = getLocales()[0]?.languageCode ?? 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

/**
 * i18n-js renders a missing key as the literal string `[missing "mn." translation]`, and it does
 * that for an empty or undefined key too — so `i18n.t(someKey ?? '')` puts that marker straight in
 * front of a user. Use this wherever the key is data (an engine-supplied `nameKey`, a value looked
 * up in a map) rather than a literal written at the call site.
 */
export function tKey(
  key: string | null | undefined,
  fallback = '',
  options?: Record<string, unknown>,
): string {
  return key ? i18n.t(key, options) : fallback;
}
