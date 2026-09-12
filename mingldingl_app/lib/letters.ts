import type { Message } from '../hooks/useChat';
import { threadDay } from './worldTime';

export interface DayStart { day: number | null; iso: string }

export interface LetterMarks {
  dayStarts: Map<string, DayStart>;
  sealBreaks: Map<string, number>;
}

/** The engine's `RevealService.MutualMessageCount`: one ahead of the quieter side, never more. */
function mutualCount(total: number, mine: number, theirs: number): number {
  return Math.min(total, 2 * Math.min(mine, theirs) + 1);
}

/** Rungs of the ladder reached by a mutual count: the ladder's first rung is level 1. */
function levelFor(mutual: number, ladder: readonly number[]): number {
  let level = 0;
  ladder.forEach((needed, i) => { if (mutual >= needed) level = i + 1; });
  return level;
}

/**
 * Where the ledger draws a day heading and where it draws "a seal broke here".
 *
 * Seal rows are only placed on a fully loaded thread: the count that breaks a seal is the whole
 * history's, and a page that begins mid-conversation cannot know how many letters came before
 * it. Once the last page is in, the rows appear where the rungs were crossed. A match born above
 * the first rung (a floor set at creation) still shows its rows at the crossings — they mark
 * where the letters earned the level, which is what the ledger records.
 */
export function letterMarks(
  messages: readonly Message[],
  myId: string | null | undefined,
  opts: { threadStartIso?: string; ladder: readonly number[]; complete: boolean },
): LetterMarks {
  const dayStarts = new Map<string, DayStart>();
  const sealBreaks = new Map<string, number>();

  let lastDayKey: string | null = null;
  let total = 0, mine = 0, theirs = 0;
  let level = 0;

  for (const m of messages) {
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDayKey) {
      dayStarts.set(m.id, {
        day: opts.threadStartIso ? threadDay(m.createdAt, opts.threadStartIso) : null,
        iso: m.createdAt,
      });
      lastDayKey = dayKey;
    }

    if (!opts.complete) continue;
    total += 1;
    if (m.senderId === 'me' || (!!myId && m.senderId === myId)) mine += 1; else theirs += 1;
    const next = levelFor(mutualCount(total, mine, theirs), opts.ladder);
    if (next > level) {
      if (next >= 2) sealBreaks.set(m.id, next);
      level = next;
    }
  }

  return { dayStarts, sealBreaks };
}
