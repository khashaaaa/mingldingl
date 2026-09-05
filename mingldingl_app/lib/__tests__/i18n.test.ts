import { translations, normalizeLocale, SUPPORTED_LOCALES } from '../i18n';

describe('i18n key parity', () => {
  it('has the same keys in en and mn', () => {
    const enKeys = Object.keys(translations.en).sort();
    const mnKeys = Object.keys(translations.mn).sort();
    expect(mnKeys).toEqual(enKeys);
  });

  it('interpolation variables match between en and mn for every key', () => {
    const varsIn = (s: string) => [...s.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatches: string[] = [];
    for (const key of Object.keys(translations.en)) {
      const enVars = varsIn((translations.en as Record<string, string>)[key]);
      const mnVars = varsIn((translations.mn as Record<string, string>)[key]);
      if (JSON.stringify(enVars) !== JSON.stringify(mnVars)) {
        mismatches.push(`${key}: en=[${enVars}] mn=[${mnVars}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('normalizeLocale', () => {
  it.each(SUPPORTED_LOCALES)('keeps the supported locale %s', (locale) => {
    expect(normalizeLocale(locale)).toBe(locale);
  });

  // The engine stores only en/mn and 400s on anything else, so a device set to any other
  // language must not have its raw code sent as preferredLocale.
  it.each(['ru', 'ko', 'zh', 'en-US', '', null, undefined])(
    'falls back to en for %p', (locale) => {
      expect(normalizeLocale(locale)).toBe('en');
    });
});
