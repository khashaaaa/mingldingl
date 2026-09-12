import { letterMarks } from '../letters';
import type { Message } from '../../hooks/useChat';

const LADDER = [1, 5, 15, 30];
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
let n = 0;
const msg = (senderId: string, createdAt: string): Message => ({ id: `m${++n}`, matchId: 'x', senderId, content: 'hi', createdAt });

describe('letterMarks · days', () => {
  beforeEach(() => { n = 0; });
  it('marks the first message and each message that opens a new local day, counted from the thread start', () => {
    const start = at(2026, 9, 10, 8);
    const ms = [msg('a', at(2026, 9, 10, 9)), msg('b', at(2026, 9, 10, 20)), msg('a', at(2026, 9, 12, 7))];
    const { dayStarts } = letterMarks(ms, 'a', { threadStartIso: start, ladder: LADDER, complete: true });
    expect([...dayStarts.entries()]).toEqual([
      ['m1', { day: 1, iso: ms[0].createdAt }],
      ['m3', { day: 3, iso: ms[2].createdAt }],
    ]);
  });
  it('still turns the day without a thread start, with no ordinal to give', () => {
    const ms = [msg('a', at(2026, 9, 10)), msg('b', at(2026, 9, 11))];
    const { dayStarts } = letterMarks(ms, 'a', { ladder: LADDER, complete: true });
    expect(dayStarts.get('m1')).toEqual({ day: null, iso: ms[0].createdAt });
    expect(dayStarts.get('m2')).toEqual({ day: null, iso: ms[1].createdAt });
  });
});

describe('letterMarks · seals', () => {
  beforeEach(() => { n = 0; });
  const alternating = (count: number) => Array.from({ length: count }, (_, i) => msg(i % 2 === 0 ? 'me' : 'them', at(2026, 9, 10, 1 + i)));
  it('breaks the first seal on the fifth mutual letter of a balanced exchange', () => {
    const { sealBreaks } = letterMarks(alternating(6), 'me', { ladder: LADDER, complete: true });
    expect([...sealBreaks.entries()]).toEqual([['m5', 2]]);
  });
  it('never breaks a seal for a monologue', () => {
    const ms = Array.from({ length: 12 }, (_, i) => msg('me', at(2026, 9, 10, 1 + i)));
    expect(letterMarks(ms, 'me', { ladder: LADDER, complete: true }).sealBreaks.size).toBe(0);
  });
  it('counts an optimistic "me" sender as mine', () => {
    const ms = [msg('me', at(2026, 9, 10, 1)), msg('them', at(2026, 9, 10, 2)), msg('me', at(2026, 9, 10, 3)), msg('them', at(2026, 9, 10, 4)), msg('me', at(2026, 9, 10, 5))];
    ms[4].senderId = 'me';
    expect(letterMarks(ms, 'user-1', { ladder: LADDER, complete: true }).sealBreaks.get('m5')).toBe(2);
  });
  it('places nothing while earlier history is still unloaded', () => {
    expect(letterMarks(alternating(6), 'me', { ladder: LADDER, complete: false }).sealBreaks.size).toBe(0);
  });
  it('reads the hydrated ladder, not a literal', () => {
    const { sealBreaks } = letterMarks(alternating(4), 'me', { ladder: [1, 3, 15, 30], complete: true });
    expect([...sealBreaks.entries()]).toEqual([['m3', 2]]);
  });
});
