import { i18n } from './i18n';

// Single shared date formatter — locale-aware (follows the app's active
// locale, not just the device default) and NaN-safe (an unparseable/blank
// ISO string renders as '' instead of "Invalid Date"). Previously
// membership.tsx, date-log.tsx, and ScoreHistoryList.tsx each reimplemented
// this independently with different levels of correctness; this is based on
// date-log.tsx's version, which was the most correct of the three.
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(i18n.locale === 'mn' ? 'mn-MN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
