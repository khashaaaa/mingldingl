import type { components } from '../lib/api/api.generated';
import type { Oath } from './user';

export type MatchStatus = 'Pending' | 'Active' | 'Ghosted' | 'Completed';

export interface DeepFields {
  hasKids: boolean | null;
  smokingHabit: string | null;
  drinkingHabit: string | null;
  religion: string | null;
  lifestyle: string | null;
}

export interface PartialUser {
  displayName?: string;
  firstPhoto?: string;
  bio?: string;
  age?: number;
  secondPhoto?: string;
  thirdPhoto?: string;
  district?: string;
  deep?: DeepFields | null;

  isDeleted?: boolean;
  oath?: Oath | null;
  oathProven?: boolean;
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

  flameRiteProposedById?: string | null;
  flameRiteProposedAt?: string | null;
  flameRiteAcceptedAt?: string | null;
  flameRiteCompletedAt?: string | null;

  flameRiteDurationMinutes: number;
  flameRiteRequired: boolean;
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
      deep: o.deep
        ? {
            hasKids: o.deep.hasKids ?? null,
            smokingHabit: o.deep.smokingHabit ?? null,
            drinkingHabit: o.deep.drinkingHabit ?? null,
            religion: o.deep.religion ?? null,
            lifestyle: o.deep.lifestyle ?? null,
          }
        : null,
      isDeleted: o.isDeleted ?? false,
      oath: (o.oath as Oath | undefined) ?? null,
      oathProven: o.oathProven ?? false,
    },
    weaverDisplayName: d.weaverDisplayName ?? undefined,
    flameRiteProposedById: d.flameRiteProposedById ?? null,
    flameRiteProposedAt: d.flameRiteProposedAt ?? null,
    flameRiteAcceptedAt: d.flameRiteAcceptedAt ?? null,
    flameRiteCompletedAt: d.flameRiteCompletedAt ?? null,
    flameRiteDurationMinutes: d.flameRiteDurationMinutes ?? 5,
    flameRiteRequired: d.flameRiteRequired ?? true,
  };
}
