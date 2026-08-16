import type { components } from '../lib/api/api.generated';

export interface BlockedUser {
  userId: string;
  displayName: string;
  firstPhoto?: string;
  blockedAt: string;
}

export function parseBlockedUser(d: components['schemas']['BlockedUserResponse']): BlockedUser {
  return {
    userId: d.userId ?? '',
    displayName: d.displayName ?? '',
    firstPhoto: d.firstPhoto ?? undefined,
    blockedAt: d.blockedAt ?? '',
  };
}
