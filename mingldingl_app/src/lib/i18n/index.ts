import { useSyncExternalStore } from 'react';
import en from './en.json';
import mnJson from './mn.json';

export type StringKey = keyof typeof en;
export type Locale = 'en' | 'mn' | 'pseudo';
type Vars = Record<string, string | number>;

const mn: Partial<Record<StringKey, string>> = mnJson;

let current: Locale = 'en';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** Switches every visible string at once. Persisting it (device, profile) is the caller's job. */
export function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  for (const fn of listeners) fn();
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLocale,
    getLocale,
  );
}

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** Mongolian falls back to English until a native speaker translates the line — never a raw key. */
export function t(key: StringKey, vars?: Vars): string {
  const base = en[key];
  if (current === 'mn') return fill(mn[key] ?? base, vars);
  if (current === 'pseudo') return pseudo(fill(base, vars));
  return fill(base, vars);
}

/** Whether the line shows in Mongolian right now (Mongolian chosen and a native speaker wrote it). */
export const showsMn = (key: StringKey) => current === 'mn' && mn[key] !== undefined;

/**
 * A line built from other lines (a tier name inside "Ascended to {{tier}}"): every piece is taken
 * in the language the line itself is shown in, so an untranslated line never carries a Mongolian
 * word mid-sentence, nor a translated one an English word. `parts` name string keys; `vars` are
 * plain values.
 */
export function tLine(key: StringKey, parts: Record<string, StringKey>, vars?: Vars): string {
  const lineIsMn = showsMn(key);
  const pick = (k: StringKey) => (current === 'mn' && !lineIsMn ? en[k] : t(k));
  const filled: Vars = { ...vars };
  for (const [name, k] of Object.entries(parts)) filled[name] = pick(k);
  return t(key, filled);
}

/** A value the engine sends as a word (an oath, a gender) in the person's language; unknown → as sent. */
export function tValue(group: 'oath' | 'gender', value: string): string {
  const key = `${group}.${value}`;
  return key in en ? t(key as StringKey) : value;
}

/**
 * A place as the person reads it: the engine keeps the Latin name (it is the key), the app shows it
 * in the person's language ("Bayangol" → "Баянгол"), never with the "(UB)" that only tells a
 * capital district from a namesake province centre. Unknown → as stored.
 */
export function tPlace(name: string): string {
  const key = `place.${name}`;
  return key in en ? t(key as StringKey) : name.replace(/ \(UB\)$/, '');
}

/** A partner place's name: its Mongolian name for a Mongolian reader once the keepers wrote one. */
export function tVenue(v: { name: string; nameMn?: string | null }): string {
  return current === 'mn' && v.nameMn ? v.nameMn : v.name;
}

/** An engine rule in the person's language when the app has its line (`error.<code>`); else as sent. */
export function tError(code: string, message: string): string {
  const key = `error.${code}`;
  return key in en ? t(key as StringKey) : message;
}

const CYR: Record<string, string> = {
  a: 'а',
  e: 'е',
  o: 'ө',
  u: 'ү',
  i: 'и',
  c: 'с',
  p: 'р',
  x: 'х',
  y: 'у',
  k: 'к',
  m: 'м',
  h: 'н',
  t: 'т',
  b: 'б',
};

/** Development aid: Cyrillic look-alikes, padded to ~1.4x, to prove a layout survives Mongolian. */
export function pseudo(s: string): string {
  const swapped = s.replace(/[a-z]/g, (c) => CYR[c] ?? c);
  const pad = Math.ceil(s.length * 0.4);
  return `${swapped} ${'ӨҮ'.repeat(Math.ceil(pad / 2)).slice(0, Math.max(1, pad - 1))}`;
}

type CountedKey<K extends string> = K extends `${infer B}_one`
  ? `${B}_other` extends StringKey
    ? B
    : never
  : never;

/** A counted line: `<key>_one` for exactly one, `<key>_other` otherwise ({{count}} is filled in). */
export function tCount(key: CountedKey<StringKey>, count: number, vars?: Vars): string {
  return t(`${key}_${count === 1 ? 'one' : 'other'}` as StringKey, { count, ...vars });
}
