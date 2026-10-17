import { useEffect, useState } from 'react';
import { type StringKey, showsMn, t, tLine } from '@/lib/i18n';

/** "12m", "5h", "3d" — how long ago, for list rows. */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (mins < 60) return t('time.minutes', { n: Math.max(1, mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  return t('time.days', { n: Math.floor(hours / 24) });
}

/** "6h 12m" until a moment. */
export function until(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60_000));
  return t('time.hm', { h: Math.floor(mins / 60), m: mins % 60 });
}

/** Whole hours between two moments, never below zero. */
export const hoursBetween = (from: string | number, to: string | number) =>
  Math.max(
    0,
    Math.round(
      ((typeof to === 'number' ? to : Date.parse(to)) -
        (typeof from === 'number' ? from : Date.parse(from))) /
        3_600_000,
    ),
  );

/** 21:40 on the person's clock. */
export const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** The calendar day of a moment on the person's clock, as yyyy-mm-dd. */
export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The device clock, ticking by the minute — for countdowns, never a server poll. */
export function useMinute(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** English ordinal suffix (Hermes has no Intl.PluralRules): 1st 2nd 3rd 4th … 11th 12th 13th … 21st. */
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
};

/**
 * A line on the world's calendar: "the 4th dawn of the tenth moon". The day and the moon take the
 * language the line is shown in — English ordinals while the line is English (also in Mongolian,
 * until it is translated), the bare number around which the translator writes Mongolian's own form.
 */
export function moonLine(key: StringKey, iso: string, vars?: Record<string, string | number>): string {
  const d = new Date(iso);
  const day = showsMn(key) ? String(d.getDate()) : ordinal(d.getDate());
  return tLine(key, { month: `moon.${d.getMonth() + 1}` as StringKey }, { ...vars, day });
}
