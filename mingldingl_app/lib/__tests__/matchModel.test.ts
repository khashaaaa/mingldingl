import { parseMatch } from '../../models/match';

describe('parseMatch', () => {
  it('carries the day the match was made, and tolerates its absence', () => {
    const base = { matchId: 'm', otherUserId: 'u', status: 'Active', otherUser: {} };
    expect(parseMatch({ ...base, createdAt: '2026-09-10T02:00:00Z' } as never).createdAt).toBe('2026-09-10T02:00:00Z');
    expect(parseMatch(base as never).createdAt).toBeUndefined();
  });
});
