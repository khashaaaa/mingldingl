import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './en';
import { mn } from './mn';

export const translations = { en, mn };

export const SUPPORTED_LOCALES = ['en', 'mn'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The device language code is whatever the OS is set to — `ru`, `ko`, `zh`. The app already
 * *renders* those in English via `enableFallback`, but the engine stores only `en` or `mn` and
 * rejects anything else, so an unnormalised code sent as `preferredLocale` fails account creation
 * outright. Everything that leaves the app or reaches the store goes through here.
 */
export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : 'en';
}

export const i18n = new I18n(translations);
i18n.locale = normalizeLocale(getLocales()[0]?.languageCode);
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
