import type { components } from '../lib/api/api.generated';

export type GemTier = 'Garnet' | 'Opal' | 'Amethyst' | 'Sapphire' | 'Ruby' | 'Emerald';
export type MembershipLevel = 'Free' | 'Silver' | 'Gold';

export type Oath = 'Bond' | 'Fate' | 'Kinship';

export interface UserProfile {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  city: string;
  bio: string;
  photoUrls: string[];

  membershipLevel: MembershipLevel;
  isProfileComplete: boolean;
  equippedFrameId?: string | null;
  equippedTitleId?: string | null;
  hasKids?: boolean | null;
  smokingHabit?: string | null;
  drinkingHabit?: string | null;
  religion?: string | null;
  lifestyle?: string | null;
  pushEnabled: boolean;
  ageMin: number;
  ageMax: number;
  isPaused: boolean;
  phoneNumber?: string | null;
  referralCode?: string | null;
  oath: Oath | null;
  oathProven: boolean;

  oathEncountersHeld: number | null;
  oathEncountersNeeded: number | null;
  /** Days between a deletion request and anonymisation; admin-tunable, quoted in the deletion dialogs. */
  deletionGraceDays: number;
}

export type Candidate = UserProfile & { gemTier: GemTier };

export function parseUserProfile(d: components['schemas']['UserResponse']): UserProfile {
  return {
    id:               d.id                ?? '',
    displayName:      d.displayName        ?? '',
    age:              d.age                ?? 0,
    gender:           d.gender             ?? '',
    city:             d.city               ?? '',
    bio:              d.bio                ?? '',
    photoUrls:        d.photoUrls          ?? [],
    membershipLevel:  (d.membershipLevel as MembershipLevel) ?? 'Free',
    isProfileComplete: d.isProfileComplete ?? false,
    equippedFrameId:  d.equippedFrameId    ?? null,
    equippedTitleId:  d.equippedTitleId    ?? null,
    hasKids:          d.hasKids            ?? null,
    smokingHabit:     d.smokingHabit       ?? null,
    drinkingHabit:    d.drinkingHabit      ?? null,
    religion:         d.religion           ?? null,
    lifestyle:        d.lifestyle          ?? null,
    pushEnabled:      d.pushEnabled        ?? true,
    ageMin:           d.ageMin             ?? 18,
    ageMax:           d.ageMax             ?? 99,
    isPaused:         d.isPaused           ?? false,
    phoneNumber:      d.phoneNumber        ?? null,
    referralCode:     d.referralCode       ?? null,
    oath:             (d.oath as Oath | undefined) ?? null,
    oathProven:       d.oathProven         ?? false,
    oathEncountersHeld:   d.oathEncountersHeld   ?? null,
    oathEncountersNeeded: d.oathEncountersNeeded ?? null,
    deletionGraceDays: d.deletionGraceDays ?? 7,
  };
}
