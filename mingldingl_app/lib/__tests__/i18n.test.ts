import { translations, normalizeLocale, AWAITING_MN_TRANSLATION, SUPPORTED_LOCALES } from '../i18n';

describe('i18n key parity', () => {
  it('has the same keys in en and mn, bar the ones awaiting a native speaker', () => {
    const awaiting = new Set<string>(AWAITING_MN_TRANSLATION);
    const enKeys = Object.keys(translations.en).filter((k) => !awaiting.has(k)).sort();
    const mnKeys = Object.keys(translations.mn).sort();
    expect(mnKeys).toEqual(enKeys);
  });

  // Keeps the debt list honest in both directions: a key that got translated, or one that was
  // renamed away, has to leave the list rather than sit there looking like outstanding work.
  it('lists only keys that exist in en and are genuinely missing from mn', () => {
    for (const key of AWAITING_MN_TRANSLATION) {
      expect(Object.keys(translations.en)).toContain(key);
      expect(Object.keys(translations.mn)).not.toContain(key);
    }
  });

  it('interpolation variables match between en and mn for every key', () => {
    const varsIn = (s: string) => [...s.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatches: string[] = [];
    const awaiting = new Set<string>(AWAITING_MN_TRANSLATION);
    for (const key of Object.keys(translations.en)) {
      if (awaiting.has(key)) continue;
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
