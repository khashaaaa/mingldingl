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
  'when_candle', 'when_today', 'when_tomorrow', 'when_dawns', 'when_passed',
  // WorldClock and the three clocks (Wave 2 move 13): the two world sentences and the OTP
  // screen's world-speak line. Same reason as above — `mn` keeps the exact clock outright.
  'gates_close', 'first_bell', 'verify_match_burns',
  'ordinal_1', 'ordinal_2', 'ordinal_3', 'ordinal_4', 'ordinal_5', 'ordinal_6',
  'ordinal_7', 'ordinal_8', 'ordinal_9', 'ordinal_10', 'ordinal_11', 'ordinal_12',
  // Thirteen through thirty-one arrived with the hearth's dawn count (Wave 4 Task 5).
  'ordinal_13', 'ordinal_14', 'ordinal_15', 'ordinal_16', 'ordinal_17', 'ordinal_18',
  'ordinal_19', 'ordinal_20', 'ordinal_21', 'ordinal_22', 'ordinal_23', 'ordinal_24',
  'ordinal_25', 'ordinal_26', 'ordinal_27', 'ordinal_28', 'ordinal_29', 'ordinal_30',
  'ordinal_31',
  // The fire's state (Wave 3 move 2). The dawn counts and most of this copy are read by
  // lib/fire.ts's fireLine/fireEyebrow/fireVerdict; fire_law is the Quest Log's footer and
  // fire_embers_strip(_one) is the chat screen's embers banner (app/chat/[matchId].tsx).
  'count_1', 'count_2', 'count_3', 'count_4', 'count_5', 'count_6',
  'count_7', 'count_8', 'count_9', 'count_10', 'count_11', 'count_12',
  'fire_burning', 'fire_embers', 'fire_frozen',
  'fire_line_their_turn', 'fire_line_my_turn', 'fire_line_embers', 'fire_line_embers_one',
  'fire_line_frozen', 'fire_line_frozen_they', 'fire_line_frozen_you', 'fire_line_severed',
  'fire_law', 'fire_embers_strip', 'fire_embers_strip_one',
  // The seals (Wave 2).
  'seals_title', 'seals_broken_0', 'seals_broken_1', 'seals_broken_2', 'seals_broken_3',
  'seals_left_0', 'seals_left_1', 'seals_left_2', 'seals_left_3', 'seals_next_at',
  'seal_under_wax', 'age_winters', 'seals_deep_membership', 'seals_climb', 'seals_law', 'seals_close',
  'seal_breaks_2', 'seal_breaks_3', 'seal_breaks_4',
  'seal_broke_2', 'seal_broke_3', 'seal_broke_4',
  // The ledger's pieces (Wave 2 move 2): the day heading and the send seal's label.
  'thread_day', 'letter_seal',
  // The Fire's sealed likeness (Wave 2 move 1), and the oath as a phrase in the card's eyebrow.
  'seek_sealed_hint', 'seek_sealed_a11y', 'oath_sworn_to', 'oath_seeking',
  // The Frozen Gate (Wave 3 move 5): the sub-line under the header and each row's dawn line.
  'frozen_gate_sub', 'shut_out_dawn',
  // The Guild House (Wave 3 move 8): the membership screen redrawn as a building.
  'guild_house', 'guild_house_sub', 'guild_house_sub_hall', 'guild_house_sub_high',
  'floor_Free', 'floor_Silver', 'floor_Gold', 'you_are_here', 'price_a_month',
  'perk_summons_night', 'climb', 'climb_to', 'guild_terms',
  // The Hall of Names (Wave 3 move 11): the leaderboard redrawn as a stone wall of ranks.
  'hall_of_names', 'hall_sub', 'your_mark', 'hall_law',
  // The Ascent as a night sky (Wave 3 move 12): the progression screen redrawn as a climb through
  // six gem stars.
  'ascent_sub', 'ascent_you', 'ascent_to_go', 'ascent_beyond', 'ascent_dawns',
  // The Campaign as a cave (Wave 3 move 9): the sub-line under the header and the dragon's
  // locked-boss line.
  'campaign_sub', 'campaign_dragon_sleeps',
  // The keepsake card (Wave 3 move 10): the shareable character card as a Wanted poster and its
  // full-screen preview.
  'wanted', 'wanted_for', 'wanted_for_none', 'keepsake_line', 'keepsake_line_one', 'keepsake_line_none',
  'post_it', 'keep_it', 'keepsake_preview',
  // The Flame Rite's five states, in the voice (Wave 3 Task 11): the complete state's second
  // line, and the video screen's own retry label.
  'rite_complete_sub', 'rite_try_again',
  // The hearth's scaffolding (Wave 4 Task 4): the header's way-home tap and the candle row.
  'go_home', 'candles_left',
  // The hearth itself (Wave 4 Task 5, move 6): the dawn eyebrow, the window's four hours, the
  // wax's law, the White Moon, the judged fires and the six destinations.
  'hearth_dawn', 'hearth_dawn_unknown', 'hearth_sky',
  'sky_night', 'sky_dawn', 'sky_day', 'sky_dusk',
  'hearth_candles', 'hearth_white_moon', 'hearth_white_moon_sub',
  'hearth_judged', 'hearth_fire_burns', 'hearth_fire_embers', 'hearth_fire_froze',
  'their_turn', 'your_turn', 'hearth_no_fires',
  'dest_fire', 'dest_letters', 'dest_square', 'dest_forge', 'dest_mirror', 'dest_satchel',
  'hearth_law',
  // The chronicle counts dawns too (Wave 4 Task 6): its own day-marker heading.
  'chronicle_dawn',
  // The Square as a plaza (Wave 4 Task 7, move 9): the hero card's sub line, its stat labels, the
  // round-over lantern count, and the plaza drawing's own accessibility label.
  'plaza_sub_open', 'plaza_sub_open_not_mine', 'plaza_sub_locked',
  'plaza_first_bell', 'plaza_rounds', 'plaza_rounds_value',
  'plaza_closed_lit', 'plaza_closed_lit_one',
  'plaza_label', 'plaza_label_mine', 'plaza_label_none',
  // The Second Bell (Wave 4 Task 8): the round screen's own header title and the strip's eyebrow
  // and helper line.
  'bell_title', 'bell_question', 'bell_decide',
  // The Satchel (Wave 4 Task 9): the header, the nine rows' names and lines, the three-row
  // summary, and the footer law.
  'satchel_title', 'satchel_sub',
  'satchel_candles', 'satchel_candles_line',
  'satchel_arrows', 'satchel_arrows_line', 'satchel_arrows_one', 'satchel_arrows_none',
  'satchel_lantern', 'satchel_lantern_lit', 'satchel_lantern_unlit', 'satchel_lantern_none',
  'satchel_oath', 'satchel_oath_line', 'satchel_oath_proven', 'satchel_oath_sworn', 'satchel_oath_none',
  'satchel_key', 'satchel_key_held', 'satchel_key_none',
  'satchel_word', 'satchel_word_none',
  'satchel_honour', 'satchel_honour_none',
  'satchel_seals', 'satchel_seals_line', 'satchel_seals_one_thread', 'satchel_seals_none',
  'satchel_card', 'satchel_card_line',
  'satchel_sum_candles', 'satchel_sum_candles_one', 'satchel_sum_candles_none', 'satchel_sum_arrows', 'satchel_sum_arrows_one',
  'satchel_sum_lantern',
  'satchel_law',
  // Copy that was reshaped in code (leaderboard's empty-city sub line, the unsealing ceremony's
  // second sentence) and the spoken star rating.
  'hall_sub_no_city', 'seals_next_at_sentence', 'seals_left_0_sentence', 'stars_of_five',
  // The plaza drawing's carved labels, moved out of the SVG as literals.
  'plaza_gate_north', 'plaza_gate_south', 'plaza_bell', 'plaza_you',
  // Audit W5: number-in-sentence formats (a translator only confirms the order) and the add-photo tile's label.
  'count_of_total', 'points_gain', 'next_tier_arrow', 'name_age', 'tier_score', 'getting_started_progress', 'add_photo',
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
