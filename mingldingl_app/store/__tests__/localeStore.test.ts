import { useLocaleStore } from '../localeStore';
import { i18n } from '../../lib/i18n';
import * as localePreference from '../../lib/localePreference';

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
