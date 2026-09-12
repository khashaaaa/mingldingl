import { parseMatch } from '../../models/match';

describe('parseMatch', () => {
  it('carries the day the match was made, and tolerates its absence', () => {
    const base = { matchId: 'm', otherUserId: 'u', status: 'Active', otherUser: {} };
    expect(parseMatch({ ...base, createdAt: '2026-09-10T02:00:00Z' } as never).createdAt).toBe('2026-09-10T02:00:00Z');
    expect(parseMatch(base as never).createdAt).toBeUndefined();
  });

  it('carries when the last letter was sent and by whom, and tolerates their absence', () => {
    const base = { matchId: 'm', otherUserId: 'u', status: 'Active', otherUser: {} };
    const withLastMessage = parseMatch({
      ...base,
      lastMessageAt: '2026-09-12T10:00:00Z',
      lastMessageSenderId: 'u',
    } as never);
    expect(withLastMessage.lastMessageAt).toBe('2026-09-12T10:00:00Z');
    expect(withLastMessage.lastMessageSenderId).toBe('u');

    const withoutLastMessage = parseMatch(base as never);
    expect(withoutLastMessage.lastMessageAt).toBeUndefined();
    expect(withoutLastMessage.lastMessageSenderId).toBeUndefined();
  });
});
