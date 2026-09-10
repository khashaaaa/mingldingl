import { useCallback, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/api/queryKeys';
import { profileCompleteness, type WorldState } from '../lib/world/light';
import type { Match } from '../models/match';
import type { UserProfile } from '../models/user';
import type { Campaign } from './useCampaign';
import type { Message } from './useChat';
import type { TownSquareNextSession } from './useTownSquareSession';

interface ScoreShape { dailyMatchBudget?: number | null; dailyMatchesUsed?: number | null; dailyMatchesRemaining?: number | null }
interface OwnedItemShape { itemType?: string | null }

/**
 * Reads a query's cache without ever fetching it. The world layer is a passenger: it lights rooms
 * from data the screens already asked for, and must never become a reason the app makes a request.
 * A `useQuery` here — even a disabled one — would put a second observer on keys whose refetch
 * behaviour is tuned per screen; subscribing to the cache directly cannot.
 */
function useCached<T>(qc: QueryClient, key: readonly unknown[] | null): T | undefined {
  const subscribe = useCallback((cb: () => void) => qc.getQueryCache().subscribe(cb), [qc]);
  const getSnapshot = useCallback(
    () => (key ? qc.getQueryData<T>(key) : undefined),
    // The key is a fresh array each render, so hash it rather than depend on identity.
    [qc, key ? JSON.stringify(key) : null],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The newest message's timestamp; null for a thread with nothing in it yet. */
export function newestMessageAt(messages: readonly Message[]): string | null {
  let newest: string | null = null;
  for (const m of messages) {
    if (newest == null || m.createdAt > newest) newest = m.createdAt;
  }
  return newest;
}

/**
 * @param matchId the delve currently open, when there is one — the Deep is lit per match.
 * @param now the clock the time-based ramps read. The provider passes its minute tick so a chat
 *   left open cools on its own; defaulting to `Date.now()` keeps the hook honest when called bare.
 */
export function useWorldState(matchId?: string, now: number = Date.now()): WorldState {
  const qc = useQueryClient();
  const profile = useCached<UserProfile>(qc, queryKeys.userProfile);
  const score = useCached<ScoreShape>(qc, queryKeys.score);
  const matches = useCached<Match[]>(qc, queryKeys.matches);
  const session = useCached<TownSquareNextSession>(qc, queryKeys.townSquareNextSession);
  const items = useCached<OwnedItemShape[]>(qc, queryKeys.itemsMine);
  const campaign = useCached<Campaign>(qc, matchId ? queryKeys.campaign(matchId) : null);
  const messages = useCached<Message[]>(qc, matchId ? queryKeys.messages(matchId) : null);

  const budgetTotal = score?.dailyMatchBudget ?? null;
  const used = score?.dailyMatchesUsed ?? 0;

  return {
    budget: budgetTotal == null ? null : {
      budget: budgetTotal,
      remaining: score?.dailyMatchesRemaining ?? Math.max(0, budgetTotal - used),
    },
    activeMatches: matches ? matches.filter((m) => m.status === 'Active').length : null,
    tavern: session == null ? null : {
      hasSession: session.sessionId != null,
      isRsvpd: session.isRsvpd,
    },
    delve: campaign && campaign.rooms.length > 0
      ? { cleared: campaign.clearedCount, total: campaign.rooms.length }
      : null,
    profile: profileCompleteness(profile),
    // Honours are `Title` items; tier frames are derived and would inflate the Hall's ladder.
    honours: items ? items.filter((i) => i.itemType === 'Title').length : null,
    conversation: messages ? { lastMessageAt: newestMessageAt(messages) } : null,
    now,
  };
}
