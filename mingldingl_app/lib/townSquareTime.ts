export function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return 'Any moment';

  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) return 'Any moment';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
