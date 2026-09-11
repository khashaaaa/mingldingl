import { i18n } from './i18n';

/** A moment, not just a day: "Sat, Sep 12, 20:00" — for a gathering the reader plans around. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(i18n.locale === 'mn' ? 'mn-MN' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(i18n.locale === 'mn' ? 'mn-MN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
