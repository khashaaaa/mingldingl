import type { components } from '../lib/api/api.generated';

export interface Trophy {
  matchId: string;
  activityTitle: string;
  businessName?: string;
  businessPhoto?: string;
  confirmedAt: string;
  myStars?: number;
  myMomentPhotoUrl?: string;
  mismatched: boolean;
  /** The venue's district; it is charted on the waypoints only once the encounter is `kept`. */
  district?: string;
  /** Both sides said the other turned up. */
  kept: boolean;
}

export function parseTrophy(d: components['schemas']['TrophyResponse']): Trophy {
  return {
    matchId: d.matchId ?? '',
    activityTitle: d.activityTitle ?? '',
    businessName: d.businessName ?? undefined,
    businessPhoto: d.businessPhoto ?? undefined,
    confirmedAt: d.confirmedAt ?? '',
    myStars: d.myStars ?? undefined,
    myMomentPhotoUrl: d.myMomentPhotoUrl ?? undefined,
    mismatched: d.mismatched ?? false,
    district: d.district ?? undefined,
    kept: d.kept ?? false,
  };
}
