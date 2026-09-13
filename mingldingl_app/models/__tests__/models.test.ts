import { parsePendingShip } from '../ship';
import { parseUserProfile } from '../user';

describe('parsePendingShip', () => {
  it('parses shipId and weaverDisplayName', () => {
    const ship = parsePendingShip({ shipId: 's1', weaverDisplayName: 'Bataar' } as any);
    expect(ship).toEqual({ shipId: 's1', weaverDisplayName: 'Bataar' });
  });
});

describe('parseUserProfile', () => {
  it('carries the referral code through when present', () => {
    const profile = parseUserProfile({ id: 'u1', referralCode: 'FOX392' } as any);
    expect(profile.referralCode).toBe('FOX392');
  });

  it('defaults referralCode to null when absent', () => {
    const profile = parseUserProfile({ id: 'u1' } as any);
    expect(profile.referralCode).toBeNull();
  });

  it('carries createdAt through as joinedAt', () => {
    const profile = parseUserProfile({ id: 'u1', createdAt: '2026-08-30T12:00:00Z' } as any);
    expect(profile.joinedAt).toBe('2026-08-30T12:00:00Z');
  });

  it('defaults joinedAt to undefined when createdAt is absent', () => {
    const profile = parseUserProfile({ id: 'u1' } as any);
    expect(profile.joinedAt).toBeUndefined();
  });
});
