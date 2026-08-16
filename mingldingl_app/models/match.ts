import type { components } from '../lib/api/api.generated';

export type MatchStatus = 'Pending' | 'Active' | 'Ghosted' | 'Completed';

export interface PartialUser {
  displayName?: string;
  firstPhoto?: string;
  bio?: string;
  age?: number;
  secondPhoto?: string;
  thirdPhoto?: string;
  district?: string;
  // True once the other person's account has been anonymized (7+ days past
  // their own deletion request) — every other field above is blank in that
  // case too, not just unrevealed. Render a localized placeholder, never a
  // blank name.
  isDeleted?: boolean;
}

export interface Match {
  matchId: string;
  otherUserId: string;
  status: MatchStatus;
  revealLevel: number;
  messageCount: number;
  icebreakerComplete: boolean;
  videoCallUnlocked: boolean;
  otherUser: PartialUser;
  weaverDisplayName?: string;
}

export function parseMatch(d: components['schemas']['MatchResponse']): Match {
  const o = d.otherUser ?? {};
  return {
    matchId: d.matchId ?? '',
    otherUserId: d.otherUserId ?? '',
    status: (d.status as MatchStatus) ?? 'Active',
    revealLevel: d.revealLevel ?? 0,
    messageCount: d.messageCount ?? 0,
    icebreakerComplete: d.icebreakerComplete ?? false,
    videoCallUnlocked: d.videoCallUnlocked ?? false,
    otherUser: {
      displayName: o.displayName ?? undefined,
      firstPhoto: o.firstPhoto ?? undefined,
      bio: o.bio ?? undefined,
      age: o.age ?? undefined,
      secondPhoto: o.secondPhoto ?? undefined,
      thirdPhoto: o.thirdPhoto ?? undefined,
      district: o.district ?? undefined,
      isDeleted: o.isDeleted ?? false,
    },
    weaverDisplayName: d.weaverDisplayName ?? undefined,
  };
}
