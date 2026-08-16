import { create } from 'zustand';
import { i18n } from '../lib/i18n';
import { setStoredLocale } from '../lib/localePreference';

interface LocaleState {
  locale: string;
  // Boot-time only: adopts a previously-stored locale without re-persisting it.
  hydrate: (locale: string) => void;
  setLocale: (locale: string) => Promise<void>;
}

// Subscribing to `locale` anywhere (see app/_layout.tsx) forces a re-render
// of that subscriber and everything beneath it, which is what makes a
// language switch apply instantly: nothing in this app uses React.memo, so
// one re-render at the root cascades through every mounted screen and every
// i18n.t() call inside it re-evaluates against the new i18n.locale.
export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: i18n.locale,
  hydrate: (locale) => {
    i18n.locale = locale;
    set({ locale });
  },
  setLocale: async (locale) => {
    // Apply + re-render first, persist after — persistence must never gate
    // the instant switch. On web, expo-secure-store is a stub ({}, no
    // setItemAsync at all — see CLAUDE.md), so setStoredLocale() always
    // rejects there; if it ran before set(), the UI would never react.
    i18n.locale = locale;
    set({ locale });
    try {
      await setStoredLocale(locale);
    } catch {
      // Best-effort persistence (expected to fail on web). The switch
      // already applied above regardless.
    }
  },
}));
