import { i18n } from './i18n';

export function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return i18n.t('countdown_any_moment');

  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) return i18n.t('countdown_any_moment');

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return i18n.t('countdown_hm', { hours, minutes });
  if (minutes > 0) return i18n.t('countdown_ms', { minutes, seconds });
  return i18n.t('countdown_s', { seconds });
}
