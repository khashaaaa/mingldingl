import { fireOf, fireLine, fireEyebrow, fireVerdict, fireMark } from '../fire';
import { ACCENT, INK, METAL, TEMPERATURE } from '../theme';
import type { Match } from '../../models/match';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const windows = { staleHours: 48, unansweredHours: 168 };
const myId = 'me';

/** Only the fields fireOf reads; everything else on Match is irrelevant to the fire. */
function match(overrides: Partial<Pick<Match, 'status' | 'createdAt' | 'lastMessageAt' | 'lastMessageSenderId' | 'messageCount'>>) {
  return {
    status: 'Active' as Match['status'],
    createdAt: undefined,
    lastMessageAt: undefined,
    lastMessageSenderId: undefined,
    messageCount: 0,
    ...overrides,
  };
}

describe('fireOf', () => {
  const now = at(2026, 9, 12, 9, 0);

  it('is unlit with no letters yet, dawns counted from the match itself', () => {
    const m = match({ createdAt: iso(at(2026, 9, 10, 9, 0)) });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('unlit');
    expect(fire.myTurn).toBeNull();
    expect(fire.dawns).toBe(2);
    expect(fireEyebrow(fire)).toBe('New Quest');
  });

  it('is embers at one dawn of my silence', () => {
    const m = match({
      createdAt: iso(at(2026, 9, 8, 9, 0)),
      lastMessageAt: iso(at(2026, 9, 11, 9, 0)),
      lastMessageSenderId: 'them',
    });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('embers');
    expect(fire.myTurn).toBe(true);
    expect(fire.dawns).toBe(1);
    expect(fire.judgedAtDawn).toBe(2);
    expect(fireLine(fire)).toBe('Your turn. One dawn. Judged at the second.');
  });

  it('is embers at two dawns of my silence', () => {
    const m = match({
      createdAt: iso(at(2026, 9, 8, 9, 0)),
      lastMessageAt: iso(at(2026, 9, 10, 9, 0)),
      lastMessageSenderId: 'them',
    });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('embers');
    expect(fire.dawns).toBe(2);
    expect(fireLine(fire)).toBe('Your turn. Two dawns. Judged at the second.');
  });

  it('is burning and waiting on them, day counted from the match', () => {
    const m = match({
      createdAt: iso(at(2026, 9, 9, 9, 0)),
      lastMessageAt: iso(at(2026, 9, 12, 8, 0)),
      lastMessageSenderId: myId,
    });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('burning');
    expect(fire.myTurn).toBe(false);
    expect(fire.day).toBe(4);
    expect(fireLine(fire)).toBe('Fourth day. Their turn.');
  });

  it('is frozen and ghosted when they never answered — they let it, their standing paid', () => {
    const m = match({
      status: 'Ghosted',
      createdAt: iso(at(2026, 9, 1, 9, 0)),
      lastMessageAt: iso(at(2026, 9, 7, 9, 0)),
      lastMessageSenderId: myId,
    });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('frozen');
    expect(fire.frozenBy).toBe('ghosted');
    expect(fire.dawns).toBe(5);
    expect(fire.iLetIt).toBe(false);
    expect(fireLine(fire)).toBe('Five dawns of silence. Judged at the second.');
    expect(fireVerdict(fire)).toBe('They let it freeze. Their standing paid.');
  });

  it('is frozen and ghosted the other way when I never answered', () => {
    const m = match({
      status: 'Ghosted',
      createdAt: iso(at(2026, 9, 1, 9, 0)),
      lastMessageAt: iso(at(2026, 9, 7, 9, 0)),
      lastMessageSenderId: 'them',
    });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.iLetIt).toBe(true);
    expect(fireVerdict(fire)).toBe('You let it freeze. Your standing paid.');
  });

  it('is frozen and severed on an unmatch, with no verdict to render', () => {
    const m = match({ status: 'Unmatched', createdAt: iso(at(2026, 9, 1, 9, 0)) });
    const fire = fireOf(m, myId, now, windows);
    expect(fire.state).toBe('frozen');
    expect(fire.frozenBy).toBe('severed');
    expect(fireLine(fire)).toBe('The bond was severed.');
    expect(fireVerdict(fire)).toBeNull();
  });

  it('reads a wider stale window into a later judged dawn', () => {
    const m = match({
      status: 'Ghosted',
      lastMessageAt: iso(at(2026, 9, 7, 9, 0)),
      lastMessageSenderId: myId,
    });
    const fire = fireOf(m, myId, now, { staleHours: 72, unansweredHours: 168 });
    expect(fire.judgedAtDawn).toBe(3);
  });
});

describe('fireMark', () => {
  // One table for the Log's tile and the hearth's rows: the two copies it replaced had already
  // drifted on `unlit`, so the temperatures are pinned here rather than in either component.
  it('marks each temperature with its own drawing and colour', () => {
    expect(fireMark('burning')).toEqual({ mark: 'flame', color: ACCENT.bright });
    expect(fireMark('embers')).toEqual({ mark: 'ember', color: METAL.ember });
    expect(fireMark('frozen')).toEqual({ mark: 'ice', color: TEMPERATURE.glacier });
  });

  it('draws no mark for an unlit fire, in dim ink unless the caller names its colour', () => {
    expect(fireMark('unlit')).toEqual({ mark: null, color: INK.dim });
    expect(fireMark('unlit', ACCENT.base)).toEqual({ mark: null, color: ACCENT.base });
  });

  it('lets the caller choose only the unlit colour', () => {
    expect(fireMark('burning', ACCENT.base).color).toBe(ACCENT.bright);
  });
});
