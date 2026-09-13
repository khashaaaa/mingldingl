import fs from 'fs';
import path from 'path';

/**
 * The app's own source, for the tests that assert about it rather than about a value.
 *
 * Four tests had grown their own copy of this walk — `palette`, `ladders`, `i18nCoverage` and
 * `world` — each with its own skip list. That made "what counts as app source" a thing defined
 * in four places, where adding a top-level directory means remembering it four times and a miss
 * is silent: the test still passes, it just stops looking.
 *
 * The result is memoised per worker process, because the callers ask repeatedly: `ladders`
 * alone called its walker seven times, so one jest run read 217 files nineteen hundred times.
 */
export const APP_ROOT = path.resolve(__dirname, '../..');

const SKIP = new Set([
  'node_modules', '.expo', 'android', 'ios', 'dist', '.git', 'scripts', 'uploads', 'coverage',
]);

export interface SourceFile {
  /** Path relative to the app root, e.g. `components/ui/StateBlock.tsx`. */
  rel: string;
  text: string;
}

/**
 * Blanks comment bodies while keeping their newlines, so a file that *explains* a banned pattern
 * does not read as a file *using* one, and reported line numbers still point at the right line.
 *
 * String-aware: `//` and `/*` inside a `'...'`, `"..."` or `` `...` `` literal do not start a
 * comment. The first version was a pair of regexes and missed exactly this — a line like
 * `const u = 'https://x'; i18n.t('real_key')` has its only `//` inside the URL, so `\/\/.*$`
 * read the rest of the line as a comment and blanked the real `i18n.t()` call sitting right
 * after it, which is how `i18nCoverage.test.ts` found `real_key` orphaned even though the line
 * plainly names it. This is a small scanner, not a parser: it does not walk `${}` interpolations
 * inside template literals, which the app's source never uses to hide a comment marker anyway.
 */
export function blankComments(src: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      out += c;
      // An escaped char (including an escaped quote) is consumed as a pair so it can never be
      // mistaken for the string's closing quote.
      if (c === '\\' && i + 1 < src.length) { out += src[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      i--; // let the loop's own increment re-land on the newline
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < src.length) { out += '  '; i++; } // consume the closing `*/`; loop increment lands past it
      continue;
    }
    out += c;
  }
  return out;
}

/** One JSX opening tag found in a source file: everything between the name and its closing `>`. */
export interface OpeningTag {
  /** The props text, e.g. ` hero style={styles.card}`. */
  props: string;
  /** 1-based line of the `<` that opened the tag, for a failure message that points somewhere. */
  line: number;
}

/**
 * Every `<Component ...>` opening tag in a file, for the design rules that count call sites — how
 * many panels a screen knots, how many forged buttons it carries. A regex up to the next `>` is
 * wrong often enough to matter: props hold arrow functions (`onPress={() => x}`), comparisons and
 * strings, any of which ends a naive match early and hides the props that follow. So this scans
 * forward from the tag name, tracking `{}` depth and quote state, and stops at the first `>` that
 * is genuinely outside both. It lives here rather than in one test because the next rule that
 * counts a component would otherwise copy it — which is how this file's own walk came to exist
 * in four places.
 */
export function openingTags(text: string, component: string): OpeningTag[] {
  const out: OpeningTag[] = [];
  const open = new RegExp(`<${component}(?![A-Za-z0-9_])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = open.exec(text)) !== null) {
    let depth = 0;
    let quote: string | null = null;
    let i = open.lastIndex;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') { depth++; continue; }
      if (c === '}') { depth--; continue; }
      if (c === '>' && depth === 0) break;
    }
    out.push({ props: text.slice(open.lastIndex, i), line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** Whether an opening tag passes a given prop, shorthand (`hero`) or not (`hero={x}`). */
export function hasProp(props: string, name: string): boolean {
  return new RegExp(`(^|[\\s{])${name}(\\s|=|$|/)`).test(props);
}

function walk(): SourceFile[] {
  const out: SourceFile[] = [];
  (function descend(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { descend(full); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      out.push({ rel: path.relative(APP_ROOT, full), text: fs.readFileSync(full, 'utf8') });
    }
  })(APP_ROOT);
  return out;
}

let cached: SourceFile[] | null = null;

/** Every `.ts`/`.tsx` file the app ships, tests and helpers included. */
export function allSources(): SourceFile[] {
  return (cached ??= walk());
}

/**
 * What a design-system rule applies to: the app's own screens and components, with comments
 * blanked. Excludes the tests themselves, and `lib/theme.ts` — the one file allowed to hold a
 * raw value, and the one that necessarily writes out the patterns the rules ban.
 */
export function appSources(): SourceFile[] {
  return allSources()
    .filter((f) => !f.rel.includes('__tests__') && f.rel !== path.join('lib', 'theme.ts'))
    .map((f) => ({ rel: f.rel, text: blankComments(f.text) }));
}
