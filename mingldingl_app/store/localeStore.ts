import { create } from 'zustand';
import { i18n } from '../lib/i18n';
import { setStoredLocale } from '../lib/localePreference';

interface LocaleState {
  locale: string;

  hydrate: (locale: string) => void;
  setLocale: (locale: string) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: i18n.locale,
  hydrate: (locale) => {
    i18n.locale = locale;
    set({ locale });
  },
  setLocale: async (locale) => {
    i18n.locale = locale;
    set({ locale });
    try {
      await setStoredLocale(locale);
    } catch {
    }
  },
}));
