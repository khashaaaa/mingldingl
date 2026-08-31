import { i18n } from './i18n';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(i18n.locale === 'mn' ? 'mn-MN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
