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
  // The narrated long waits' second and third lines. Their FIRST lines are already translated
  // (verify_sms_waiting, waiting_match, waiting_join, round_connecting), so a Mongolian speaker
  // sees Mongolian at the moment a wait starts and English only if it runs long. Translate and
  // delete these eight, plus quiz_answers_in below (the quiz completion card's headline while
  // waiting, which replaced its reuse of waiting_match and so is untranslated itself).
  'wait_verify_still', 'wait_verify_long',
  'wait_quiz_still', 'wait_quiz_long',
  'wait_video_still', 'wait_video_long',
  'wait_square_still', 'wait_square_long',
  'quiz_answers_in',
  // The empty-thread state (a match with zero messages). Nothing already translated fit without
  // implying a gate that doesn't exist (see next_action_icebreaker's neighbouring fix).
  'chat_empty_title', 'chat_empty_sub',
  // Time in the world's units (Wave 2). Until these are translated, `mn` keeps the exact clock.
  'when_candle', 'when_today', 'when_tomorrow', 'when_dawns',
  // WorldClock and the three clocks (Wave 2 move 13): the two world sentences and the OTP
  // screen's world-speak line. Same reason as above — `mn` keeps the exact clock outright.
  'gates_close', 'first_bell', 'verify_match_burns',
  'ordinal_1', 'ordinal_2', 'ordinal_3', 'ordinal_4', 'ordinal_5', 'ordinal_6',
  'ordinal_7', 'ordinal_8', 'ordinal_9', 'ordinal_10', 'ordinal_11', 'ordinal_12',
  // The seals (Wave 2).
  'seals_title', 'seals_broken_0', 'seals_broken_1', 'seals_broken_2', 'seals_broken_3',
  'seals_left_0', 'seals_left_1', 'seals_left_2', 'seals_left_3', 'seals_next_at',
  'seal_under_wax', 'age_winters', 'seals_deep_membership', 'seals_climb', 'seals_law',
  'seal_breaks_2', 'seal_breaks_3', 'seal_breaks_4',
  'seal_broke_2', 'seal_broke_3', 'seal_broke_4',
  // The ledger's pieces (Wave 2 move 2): the day heading and the send seal's label.
  'thread_day', 'letter_seal',
  // The Fire's sealed likeness (Wave 2 move 1), and the oath as a phrase in the card's eyebrow.
  'seek_sealed_hint', 'seek_sealed_a11y', 'oath_sworn_to', 'oath_seeking',
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

/**
 * Whether `text` contains no Cyrillic character. No Google blackletter face carries Cyrillic
 * glyphs, so this gates which titles `HeaderBar` may set in `FONTS.wordmark` — a Mongolian title,
 * or any Cyrillic text shown while the locale happens to be `en`, must fail this and fall back to
 * `FONTS.display` (Yeseva) instead. See Task 7 / Move 12 (`docs/design/sealed-fire/boards/Blackletter.dc.html`).
 */
export function isLatin(text: string): boolean {
  return !/[Ѐ-ӿ]/.test(text);
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
