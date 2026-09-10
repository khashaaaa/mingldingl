import { i18n } from './i18n';

export function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return i18n.t('countdown_any_moment');

  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) return i18n.t('countdown_any_moment');

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Sessions are scheduled days out, so without this rung the card counted in raw hours — a
  // gathering nine days away read "216ц 0м", which nobody parses as "next week".
  if (days > 0) return i18n.t('countdown_dh', { days, hours: hours % 24 });
  if (hours > 0) return i18n.t('countdown_hm', { hours, minutes });
  if (minutes > 0) return i18n.t('countdown_ms', { minutes, seconds });
  return i18n.t('countdown_s', { seconds });
}
