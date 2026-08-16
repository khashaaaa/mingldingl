import { useLocaleStore } from '../localeStore';
import { i18n } from '../../lib/i18n';
import * as localePreference from '../../lib/localePreference';

// setLocale() is the only path Settings uses to switch language now that
// the switch is instant (no more restart prompt) — it must update i18n.ts
// synchronously (so a re-render picks it up immediately), persist through
// localePreference.ts, and update the store (so subscribers, i.e.
// app/_layout.tsx's AppContent, actually re-render).
describe('localeStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('setLocale updates i18n.locale, persists, and updates store state', async () => {
    const setStoredLocale = jest.spyOn(localePreference, 'setStoredLocale').mockResolvedValue();

    await useLocaleStore.getState().setLocale('mn');

    expect(i18n.locale).toBe('mn');
    expect(setStoredLocale).toHaveBeenCalledWith('mn');
    expect(useLocaleStore.getState().locale).toBe('mn');
  });

  it('applies and re-renders even when persistence fails (e.g. web SecureStore stub)', async () => {
    jest.spyOn(localePreference, 'setStoredLocale').mockRejectedValue(new Error('setItemAsync is not a function'));

    await useLocaleStore.getState().setLocale('mn');

    expect(i18n.locale).toBe('mn');
    expect(useLocaleStore.getState().locale).toBe('mn');
  });

  it('hydrate sets i18n.locale and store state without persisting', () => {
    const setStoredLocale = jest.spyOn(localePreference, 'setStoredLocale').mockResolvedValue();

    useLocaleStore.getState().hydrate('en');

    expect(i18n.locale).toBe('en');
    expect(useLocaleStore.getState().locale).toBe('en');
    expect(setStoredLocale).not.toHaveBeenCalled();
  });
});
