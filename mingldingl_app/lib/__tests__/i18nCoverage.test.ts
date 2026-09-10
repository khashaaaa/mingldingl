import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { translations } from '../i18n';

/**
 * Key parity is covered by i18n.test.ts. What was never covered — and what let five
 * `video_error_*` keys survive the error-code refactor that deleted their lookup table —
 * is the link between a key and the code that uses it, in both directions.
 */

const ROOT = join(__dirname, '..', '..');
// `models` holds domain code that names i18n keys too — `reportReasonKey` builds the
// `report_reason_*` family there — so leaving it out made those keys look orphaned.
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'models', 'store'];

/** Key families the engine supplies as data (a `nameKey` on an API response), so no app
 *  source file ever names them literally. Adding a family here should be deliberate. */
const ENGINE_SUPPLIED = ['milestone_', 'quest_'];


function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // The translation tables themselves must not count as "a reference" to their own keys.
        if (entry !== 'node_modules' && entry !== '__tests__' && full !== join(ROOT, 'lib', 'i18n')) walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  for (const dir of SOURCE_DIRS) walk(join(ROOT, dir));
  return out;
}

const blob = sourceFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
const defined = Object.keys(translations.en);

/** Families built at the call site — i18n.t(`campaign_room_${id}`), or a key assembled first
 *  as in errors.ts's `err_${code}`. Discovered from the source rather than listed here, so a
 *  family that loses its call site shows up as orphaned keys instead of staying whitelisted.
 *
 *  Matched only where the template literal is actually used as a key — passed to i18n.t()/tKey(),
 *  or assigned to a `key` variable that then is. Filtering the list by "has at least one defined
 *  key" instead would make the third test below vacuous: a family whose keys were all renamed away
 *  would silently drop out of this list rather than fail. */
const KEY_TEMPLATE_PATTERNS = [
  /(?:i18n\.t|tKey)\(\s*`([a-z0-9]+_[a-z0-9_]*)\$\{/g,
  /\b[a-zA-Z]*[kK]ey\s*=\s*`([a-z0-9]+_[a-z0-9_]*)\$\{/g,
];
const dynamicPrefixes = [
  ...new Set(KEY_TEMPLATE_PATTERNS.flatMap((re) => [...blob.matchAll(re)].map((m) => m[1]))),
];

describe('i18n key coverage', () => {
  it('has no key that nothing in the app references', () => {
    const literals = new Set([...blob.matchAll(/['"`]([a-zA-Z0-9_]+)['"`]/g)].map((m) => m[1]));
    const orphans = defined.filter(
      (key) =>
        !literals.has(key) &&
        !ENGINE_SUPPLIED.some((p) => key.startsWith(p)) &&
        !dynamicPrefixes.some((p) => key.startsWith(p)),
    );
    expect(orphans).toEqual([]);
  });

  it('resolves every key named literally in an i18n.t() call', () => {
    const used = [...blob.matchAll(/i18n\.t\(\s*['"]([a-zA-Z0-9_]+)['"]/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((key) => !defined.includes(key)).sort();
    expect(missing).toEqual([]);
  });

  it('has at least one real key behind every dynamic prefix the code builds', () => {
    // A prefix with no keys behind it means the family was renamed or deleted out from
    // under its call site, and every lookup through it now silently falls back.
    expect(dynamicPrefixes.length).toBeGreaterThan(0);
    const empty = dynamicPrefixes.filter((p) => !defined.some((k) => k.startsWith(p)));
    expect(empty).toEqual([]);
  });

  it('has a label for every option the profile editor can actually store', () => {
    // "at least one key behind the prefix" is not enough: habit_never and habit_regularly existed
    // while the stored value was "Socially", so a real profile rendered
    // [missing "en.habit_socially"] in the chat reveal strip. Each offered value needs its own key.
    const source = readFileSync(join(ROOT, 'app/edit-profile.tsx'), 'utf8');
    const optionList = (name: string): string[] => {
      const match = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
      if (!match) throw new Error(`${name} not found in edit-profile.tsx`);
      return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };

    const expected = [
      ...optionList('SMOKING_DRINKING_OPTIONS').map((v) => `habit_${v.toLowerCase()}`),
      ...optionList('RELIGION_OPTIONS').map((v) => `religion_${v.toLowerCase()}`),
      ...optionList('LIFESTYLE_OPTIONS').map((v) => `lifestyle_${v.toLowerCase()}`),
    ];

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.filter((k) => !defined.includes(k))).toEqual([]);
  });
});
