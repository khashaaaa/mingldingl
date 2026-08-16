import { parseUserProfile } from '../user';

describe('parseUserProfile', () => {
  it('carries the referral code through when present', () => {
    const profile = parseUserProfile({ id: 'u1', referralCode: 'FOX392' } as any);
    expect(profile.referralCode).toBe('FOX392');
  });

  it('defaults referralCode to null when absent', () => {
    const profile = parseUserProfile({ id: 'u1' } as any);
    expect(profile.referralCode).toBeNull();
  });
});
