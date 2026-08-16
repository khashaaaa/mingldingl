import { translations } from '../i18n';

describe('i18n key parity', () => {
  it('has the same keys in en and mn', () => {
    const enKeys = Object.keys(translations.en).sort();
    const mnKeys = Object.keys(translations.mn).sort();
    expect(mnKeys).toEqual(enKeys);
  });

  // A translation missing a %{var} the English source has (or vice versa)
  // means i18n-js either drops the interpolated value or leaves a literal
  // "%{var}" in the rendered string — 2026-07-28 audit found this class of
  // bug was otherwise invisible to the key-parity check above.
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
