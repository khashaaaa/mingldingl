import { i18n } from './i18n';
import { countWord, ordinalWord, threadDay } from './worldTime';
import type { Match } from '../models/match';

/**
 * The state of a fire (Sealed Fire W3 move 2). Pure: given a match, who I am, now, and the
 * engine's windows, what state the fire is in and what the ledger should say. This is
 * description, not judgement — the engine alone decides ghosting/unmatching, and these helpers
 * only narrate what it will conclude. No mechanic — window, threshold, penalty — is re-derived
 * here; `windows` always comes from the live `useGhostingWindows()`.
 *
 * One of this move's EN keys has no reader in this file: `fire_law` is the Quest Log list's
 * footer ("A fire is judged at dawn…"). `fire_embers_strip` — the chat composer's embers banner —
 * is read by `app/chat/[matchId].tsx` instead, formatting its `dawns`/`judged` with this file's
 * own exported `cap`/`countWord`/`ordinalWord` so the two banners never drift apart.
 */
export type FireState = 'unlit' | 'burning' | 'embers' | 'frozen';

export interface Fire {
  state: FireState;
  /** true = mine, false = theirs, null = no letter yet */
  myTurn: boolean | null;
  /** local midnights since the last letter (or since the match, when no letter) */
  dawns: number;
  /** the dawn at which the engine judges: ceil(staleHours / 24) (48h → 2, 72h → 3; staleHours <= 0 → 1) */
  judgedAtDawn: number;
  /** which day of the thread today is (1-based), null without a start */
  day: number | null;
  /** for a frozen fire: whether I am the one who let it (null when nobody ever spoke or the thread was severed, not judged) */
  iLetIt: boolean | null;
  /** 'ghosted' | 'severed' | null — why a fire is frozen */
  frozenBy: 'ghosted' | 'severed' | null;
}

type FireMatch = Pick<Match, 'status' | 'createdAt' | 'lastMessageAt' | 'lastMessageSenderId' | 'messageCount'>;

/** Local midnights between `since` and `nowIso`, or 0 without a `since` to count from. */
function dawnsSince(nowIso: string, since: string | undefined): number {
  return since ? threadDay(nowIso, since) - 1 : 0;
}

export function fireOf(
  match: FireMatch,
  myId: string | null | undefined,
  nowMs: number,
  windows: { staleHours: number; unansweredHours: number },
): Fire {
  const nowIso = new Date(nowMs).toISOString();
  // The engine judges 48h after the last letter — for a letter sent at local hour h, dawn 2 falls
  // at 48−h and dawn 3 at 72−h, so judgement always lands at or after dawn `ceil(staleHours / 24)`
  // and strictly before the next one. `floor(...) + 1` used to name the dawn *after* that.
  const judgedAtDawn = windows.staleHours <= 0 ? 1 : Math.ceil(windows.staleHours / 24);
  const day = match.createdAt ? threadDay(nowIso, match.createdAt) : null;

  if (match.status === 'Ghosted') {
    // The at-fault party is whoever did *not* send the last letter (GhostingService's own rule) —
    // silence never spoke means nobody is judged at all.
    const senderId = match.lastMessageSenderId;
    const iLetIt = senderId != null && senderId !== myId ? true : senderId === myId ? false : null;
    return {
      state: 'frozen',
      myTurn: null,
      dawns: dawnsSince(nowIso, match.lastMessageAt ?? match.createdAt),
      judgedAtDawn,
      day,
      iLetIt,
      frozenBy: 'ghosted',
    };
  }

  if (match.status === 'Unmatched' || match.status === 'Completed') {
    return {
      state: 'frozen',
      myTurn: null,
      dawns: dawnsSince(nowIso, match.lastMessageAt ?? match.createdAt),
      judgedAtDawn,
      day,
      iLetIt: null,
      frozenBy: 'severed',
    };
  }

  if (!match.lastMessageAt) {
    return {
      state: 'unlit',
      myTurn: null,
      dawns: dawnsSince(nowIso, match.createdAt),
      judgedAtDawn,
      day,
      iLetIt: null,
      frozenBy: null,
    };
  }

  const myTurn = match.lastMessageSenderId !== myId;
  const dawns = dawnsSince(nowIso, match.lastMessageAt);
  const state: FireState = myTurn && dawns >= 1 ? 'embers' : 'burning';
  return { state, myTurn, dawns, judgedAtDawn, day, iLetIt: null, frozenBy: null };
}

/** The word that opens a sentence needs its own capital; the same word mid-sentence stays as-is.
 *  Exported so the embers strip (Task 4, `app/chat/[matchId].tsx`) can format `fire_embers_strip`'s
 *  `dawns` the same way `fireLine` formats its own — one capitalisation rule, not two. */
export function cap(word: string): string {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word;
}

export function fireLine(fire: Fire): string {
  switch (fire.state) {
    case 'unlit':
      // No letters yet, so no line to read under the name — Task 3's tile keeps the existing
      // quest_new treatment (eyebrow only) rather than rendering an empty second line.
      return '';
    case 'burning':
      return fire.myTurn
        ? i18n.t('fire_line_my_turn', { day: cap(ordinalWord(fire.day ?? 1)) })
        : i18n.t('fire_line_their_turn', { day: cap(ordinalWord(fire.day ?? 1)) });
    case 'embers':
      return fire.dawns === 1
        ? i18n.t('fire_line_embers_one', { judged: ordinalWord(fire.judgedAtDawn) })
        : i18n.t('fire_line_embers', { dawns: cap(countWord(fire.dawns)), judged: ordinalWord(fire.judgedAtDawn) });
    case 'frozen':
      return fire.frozenBy === 'severed'
        ? i18n.t('fire_line_severed')
        : i18n.t('fire_line_frozen', { dawns: cap(countWord(fire.dawns)), judged: ordinalWord(fire.judgedAtDawn) });
  }
}

/** The second, frozen-only line: whose standing paid for letting it die. Null wherever there is
 *  nobody to blame — not frozen, severed (nobody is judged), or nobody ever spoke. */
export function fireVerdict(fire: Fire): string | null {
  if (fire.state !== 'frozen' || fire.frozenBy !== 'ghosted') return null;
  if (fire.iLetIt === true) return i18n.t('fire_line_frozen_you');
  if (fire.iLetIt === false) return i18n.t('fire_line_frozen_they');
  return null;
}

export function fireEyebrow(fire: Fire): string {
  switch (fire.state) {
    case 'unlit':
      return i18n.t('quest_new');
    case 'burning':
      return i18n.t('fire_burning');
    case 'embers':
      return i18n.t('fire_embers');
    case 'frozen':
      return i18n.t('fire_frozen');
  }
}
