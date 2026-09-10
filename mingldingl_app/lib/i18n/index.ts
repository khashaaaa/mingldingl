import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './en';
import { mn } from './mn';

export const translations = { en, mn };

export const SUPPORTED_LOCALES = ['en', 'mn'] as const;

/**
 * Keys deliberately shipped English-only until a native Mongolian speaker reviews them. The house
 * rule is no AI-guessed Mongolian, and `enableFallback` renders these in English for an `mn` user
 * anyway — so an entry here is a visible gap rather than a wrong translation sitting in front of
 * someone. The parity test enforces both directions: these keys must be missing from `mn`, and
 * every other key must be present. Empty this list; never grow it.
 */
export const AWAITING_MN_TRANSLATION = [
  'hold_title', 'hold_open', 'hold_close',
  'room_gate', 'room_road', 'room_tavern', 'room_hearth', 'room_forge', 'room_hall', 'room_deep',
  'sound',
  // The report sheet. Safety copy is the last place for an AI guess at Mongolian, so it renders in
  // English until reviewed — a visible gap rather than a subtly wrong word in front of someone who
  // is already having a bad time.
  'report_user', 'report_sheet_title', 'report_sheet_intro',
  'report_reason_harassment', 'report_reason_inappropriate_photos', 'report_reason_fake_profile',
  'report_reason_scam', 'report_reason_underage', 'report_reason_off_platform_harm',
  'report_reason_other',
  'report_details_label', 'report_details_placeholder', 'report_submit',
  'report_sent_title', 'report_sent_body', 'report_failed_title', 'report_failed_body',
] as const;
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
