import { asTier, type Tier } from '@/design/components/GemBadge';
import type { TierView } from '@/lib/api/generated/model';

/** Where points stand on the ladder: the next gem, what it costs, and how far along the way. */
export function standing(points: number, ladder: TierView[] | undefined) {
  if (!ladder || ladder.length === 0)
    return { progress: 0, next: null as { points: number; tier: Tier } | null };
  const i = ladder.findLastIndex((t) => points >= t.points);
  const here = ladder[Math.max(0, i)];
  const next = ladder[i + 1];
  if (!here || !next) return { progress: 1, next: null };
  return {
    progress: (points - here.points) / (next.points - here.points),
    next: { points: next.points - points, tier: asTier(next.name) },
  };
}
