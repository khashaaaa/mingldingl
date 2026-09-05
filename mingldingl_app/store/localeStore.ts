import { create } from 'zustand';
import { i18n, normalizeLocale } from '../lib/i18n';
import { setStoredLocale } from '../lib/localePreference';

interface LocaleState {
  locale: string;

  hydrate: (locale: string) => void;
  setLocale: (locale: string) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: i18n.locale,
  hydrate: (raw) => {
    const locale = normalizeLocale(raw);
    i18n.locale = locale;
    set({ locale });
  },
  setLocale: async (raw) => {
    const locale = normalizeLocale(raw);
    i18n.locale = locale;
    set({ locale });
    try {
      await setStoredLocale(locale);
    } catch {
    }
  },
}));
