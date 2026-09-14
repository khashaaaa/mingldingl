import { useEffect } from 'react';
import { subscribeToBroadcast } from '../lib/realtime/subscribeWithRetry';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '../lib/api/queryClient';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import type { Match } from '../models/match';
import { useProfile } from './useProfile';

type MatchSource = 'like' | 'ship' | 'townsquare';

const MATCH_SOURCE_INVALIDATIONS: Record<MatchSource, readonly (readonly string[])[]> = {
  like: [queryKeys.discover, queryKeys.score],
  ship: [queryKeys.pendingShips],
  townsquare: [queryKeys.townSquareNextSession],
};

/** The per-recipient topic the engine addresses (`SupabaseBroadcastService.UserTopic`). */
export function userTopic(userId: string): string {
  return `user:${userId}`;
}

function otherUserName(matchId: string): string {
  const matches = queryClient.getQueryData<Match[]>(queryKeys.matches);
  const match = matches?.find((m) => m.matchId === matchId);
  return match?.otherUser.displayName ?? i18n.t('your_match');
}

/**
 * Whether this device has any business with `matchId`: it is in the cached match list, or a chat
 * for it has recorded a status. The engine only addresses a user's own topic now, but that topic is
 * a public channel anyone could join, so an event about a match this user is not part of is dropped
 * rather than turned into a toast or a cache write under someone else's match id.
 */
function isKnownMatch(matchId: string | null | undefined): matchId is string {
  if (!matchId) return false;
  const matches = queryClient.getQueryData<Match[]>(queryKeys.matches);
  if (matches?.some((m) => m.matchId === matchId)) return true;
  return queryClient.getQueryData(queryKeys.matchStatus(matchId)) !== undefined;
}

export function useRealtimeNudges() {
  // The engine's account id, never the Supabase `sub`: every returning user signs in through a
  // fresh anonymous identity, and the engine addresses `user:{Users.Id}`. Subscribing under the sub
  // would listen on a topic nothing is ever sent to.
  const { data: profile } = useProfile();
  const myId = profile?.id;
  const setPendingNudge = useAuthStore((s) => s.setPendingNudge);

  useEffect(() => {
    if (!myId) return;

    return subscribeToBroadcast(
      userTopic(myId),
      {
        icebreaker: (msg) => {
          const { userId, matchId } = msg.payload as { userId: string; matchId: string };
          if (userId === myId || !isKnownMatch(matchId)) return;

          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.icebreakerRevealByMatch(matchId) });
          setPendingNudge({
            icon: '🧊',
            title: i18n.t('nudge_icebreaker_answered', { name: otherUserName(matchId) }),
            matchId,
          });
        },
        quiz: (msg) => {
          const { userId, matchId } = msg.payload as { userId: string; matchId: string | null };
          if (userId === myId || !isKnownMatch(matchId)) return;

          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.quizStatusByMatch(matchId) });
          setPendingNudge({
            icon: '🎯',
            title: i18n.t('nudge_quiz_answered', { name: otherUserName(matchId) }),
            matchId,
          });
        },
        date_confirmed: (msg) => {
          const { matchId, userId, isComplete } = msg.payload as { matchId: string; userId?: string; isComplete?: boolean };
          if (userId === myId || !isKnownMatch(matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });
          queryClient.setQueryData(queryKeys.partnerPledged(matchId), !isComplete);
          queryClient.invalidateQueries({ queryKey: queryKeys.activitySuggestions(matchId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
          setPendingNudge({
            icon: '📍',
            title: i18n.t('nudge_date_confirmed', { name: otherUserName(matchId) }),
            matchId,
          });
        },
        // The one event that introduces a match this device has not cached yet, so it is gated on
        // the participant list rather than on the cache.
        match_created: (msg) => {
          const { matchId, userIds, source } = msg.payload as {
            matchId: string; userIds?: string[]; source?: MatchSource;
          };
          if (!matchId || !userIds?.includes(myId)) return;

          const alreadyKnown = queryClient.getQueryData<Match[]>(queryKeys.matches)?.some((m) => m.matchId === matchId) ?? false;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
          for (const key of MATCH_SOURCE_INVALIDATIONS[source ?? 'like'] ?? []) {
            queryClient.invalidateQueries({ queryKey: key });
          }
          if (alreadyKnown) return;
          setPendingNudge({ icon: '✨', title: i18n.t('nudge_new_match'), matchId });
        },
        message: (msg) => {
          const { senderId, matchId } = msg.payload as { senderId: string; matchId: string };
          if (senderId === myId || !isKnownMatch(matchId)) return;

          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });

          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
          if (matchId === useAuthStore.getState().activeChatMatchId) return;
          setPendingNudge({
            icon: '💬',
            title: i18n.t('nudge_new_message', { name: otherUserName(matchId) }),
            matchId,
          });
        },
        flame_rite_proposed: (msg) => {
          if (!isKnownMatch((msg.payload as { matchId?: string }).matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
        },
        flame_rite_accepted: (msg) => {
          if (!isKnownMatch((msg.payload as { matchId?: string }).matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
        },
        flame_rite_declined: (msg) => {
          if (!isKnownMatch((msg.payload as { matchId?: string }).matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
        },
        flame_rite_completed: (msg) => {
          const { matchId } = msg.payload as { matchId?: string };
          if (!isKnownMatch(matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
          queryClient.invalidateQueries({ queryKey: queryKeys.campaign(matchId) });
        },
        match_status_changed: (msg) => {
          const { matchId, status } = msg.payload as { matchId: string; status: string };
          if (!isKnownMatch(matchId)) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.matches });
          // An ended match drops straight out of the matches list, so anyone standing in that chat
          // would otherwise lose the match object without ever being told what happened.
          queryClient.setQueryData(queryKeys.matchStatus(matchId), status);

          if (status === 'Ghosted' || status === 'Completed') {
            queryClient.invalidateQueries({ queryKey: queryKeys.messages(matchId) });
          }
        },
      },
      () => { queryClient.invalidateQueries({ queryKey: queryKeys.matches }); },
    );
  }, [myId, setPendingNudge]);
}
