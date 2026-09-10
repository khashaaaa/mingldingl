import { useCallback, useRef, useState } from 'react';
import type { Message } from './useChat';

/**
 * The first word of a conversation, still sealed.
 *
 * A thread that holds exactly one message, and not yours, is someone having spoken first and you
 * not yet having read it. That is a moment, and the chat renders it as a folded letter with a wax
 * seal instead of a bubble — once. Breaking the seal is recorded per match in a ref, the same way
 * `useUnsealing` remembers what it has already seen, so a rerender, a refetch or a realtime echo
 * of that same message cannot re-seal a letter you have already opened.
 *
 * It is also only ever sealed on a thread that is *fully loaded* (`hasMore` false): a page cut
 * that happens to leave one row visible is history, not a first word. And it never seals a
 * message of your own, including an optimistic one still in flight (`senderId: 'me'`), nor
 * anything while your own id is still unknown.
 */
export function useSealedLetter(
  matchId: string | undefined,
  messages: readonly Message[],
  myId: string | null | undefined,
  hasMore: boolean,
): { sealedMessageId: string | null; unseal: () => void } {
  const opened = useRef<Set<string>>(new Set());
  // Only here so that `unseal` re-renders the caller; the record itself lives in the ref.
  const [, bump] = useState(0);

  const only = messages.length === 1 ? messages[0] : null;
  const sealed =
    !!matchId
    && !hasMore
    && !!only
    && !!myId
    && only.senderId !== myId
    && only.senderId !== 'me'
    && only.status !== 'sending'
    && only.status !== 'failed'
    && !opened.current.has(matchId);

  const unseal = useCallback(() => {
    if (!matchId || opened.current.has(matchId)) return;
    opened.current.add(matchId);
    bump((n) => n + 1);
  }, [matchId]);

  return { sealedMessageId: sealed ? only.id : null, unseal };
}
