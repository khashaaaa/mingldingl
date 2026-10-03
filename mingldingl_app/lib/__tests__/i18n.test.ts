import { translations, normalizeLocale, isLatin, lineLocale, i18n, AWAITING_MN_TRANSLATION, SUPPORTED_LOCALES } from '../i18n';

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
    // A plural key is an object of forms ({ one, other }); its variables are those of every form.
    const varsIn = (v: unknown) => [...new Set([...JSON.stringify(v ?? '').matchAll(/%\{(\w+)\}/g)].map((m) => m[1]))].sort();
    const mismatches: string[] = [];
    const awaiting = new Set<string>(AWAITING_MN_TRANSLATION);
    for (const key of Object.keys(translations.en)) {
      if (awaiting.has(key)) continue;
      const enVars = varsIn((translations.en as Record<string, unknown>)[key]);
      const mnVars = varsIn((translations.mn as Record<string, unknown>)[key]);
      if (JSON.stringify(enVars) !== JSON.stringify(mnVars)) {
        mismatches.push(`${key}: en=[${enVars}] mn=[${mnVars}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('isLatin', () => {
  // The blackletter face (`HeaderBar`'s room-name titles) carries no Cyrillic glyphs, so this is
  // the gate for which titles may render in it — see the brief for Task 7.
  it('accepts English room names', () => {
    expect(isLatin('The Fire')).toBe(true);
    expect(isLatin('Ulaanbaatar Leaderboard')).toBe(true);
  });

  it('rejects Mongolian Cyrillic room names', () => {
    expect(isLatin('Гал')).toBe(false);
    expect(isLatin('Дархны газар')).toBe(false);
  });

  it('rejects a title that mixes Latin and Cyrillic', () => {
    expect(isLatin('The Гал')).toBe(false);
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

describe('lineLocale', () => {
  // A line joining an untranslated piece to translated ones must not come out half and half.
  it('says the whole line in English while any of its keys awaits Mongolian', () => {
    const prev = i18n.locale;
    i18n.locale = 'mn';
    try {
      expect(lineLocale('your_mark')).toBe('en');
      expect(lineLocale('pts')).toBe('mn');
      expect(lineLocale('pts', 'your_mark')).toBe('en');
    } finally {
      i18n.locale = prev;
    }
  });
});
