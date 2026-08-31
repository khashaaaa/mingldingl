import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '../lib/api/queryClient';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import type { Match } from '../models/match';

type MatchSource = 'like' | 'ship' | 'townsquare';

const MATCH_SOURCE_INVALIDATIONS: Record<MatchSource, readonly (readonly string[])[]> = {
  like: [queryKeys.discover, queryKeys.score],
  ship: [queryKeys.pendingShips],
  townsquare: [queryKeys.townSquareNextSession],
};

function otherUserName(matchId: string): string {
  const matches = queryClient.getQueryData<Match[]>(queryKeys.matches);
  const match = matches?.find((m) => m.matchId === matchId);
  return match?.otherUser.displayName ?? i18n.t('your_match');
}

export function useRealtimeNudges() {
  const myId = useAuthStore((s) => s.session?.user.id);
  const setPendingNudge = useAuthStore((s) => s.setPendingNudge);

  useEffect(() => {
    if (!myId) return;

    return subscribeWithRetry(() => supabase
      .channel('app-nudges')
      .on('broadcast', { event: 'icebreaker' }, (msg) => {
        const { userId, matchId } = msg.payload as { userId: string; matchId: string };
        if (userId === myId) return;

        queryClient.invalidateQueries({ queryKey: queryKeys.icebreakerRevealByMatch(matchId) });
        setPendingNudge({
          icon: '🧊',
          title: i18n.t('nudge_icebreaker_answered', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'quiz' }, (msg) => {
        const { userId, matchId } = msg.payload as { userId: string; matchId: string | null };
        if (!matchId || userId === myId) return;

        queryClient.invalidateQueries({ queryKey: queryKeys.quizStatusByMatch(matchId) });
        setPendingNudge({
          icon: '🎯',
          title: i18n.t('nudge_quiz_answered', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'date_confirmed' }, (msg) => {
        const { matchId, userId, isComplete } = msg.payload as { matchId: string; userId?: string; isComplete?: boolean };
        if (userId === myId) return;
        queryClient.setQueryData(queryKeys.partnerPledged(matchId), !isComplete);
        queryClient.invalidateQueries({ queryKey: queryKeys.activitySuggestions(matchId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
        setPendingNudge({
          icon: '📍',
          title: i18n.t('nudge_date_confirmed', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'match_created' }, (msg) => {
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
      })
      .on('broadcast', { event: 'message' }, (msg) => {
        const { senderId, matchId } = msg.payload as { senderId: string; matchId: string };
        if (senderId === myId) return;

        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
        if (matchId === useAuthStore.getState().activeChatMatchId) return;
        setPendingNudge({
          icon: '💬',
          title: i18n.t('nudge_new_message', { name: otherUserName(matchId) }),
          matchId,
        });
      })

      .on('broadcast', { event: 'flame_rite_proposed' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
      })
      .on('broadcast', { event: 'flame_rite_accepted' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
      })
      .on('broadcast', { event: 'flame_rite_declined' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
      })
      .on('broadcast', { event: 'flame_rite_completed' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });
      })
      .on('broadcast', { event: 'match_status_changed' }, (msg) => {
        const { matchId, status } = msg.payload as { matchId: string; status: string };
        queryClient.invalidateQueries({ queryKey: queryKeys.matches });

        if (status === 'Ghosted' || status === 'Completed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(matchId) });
        }
      }),
      () => { queryClient.invalidateQueries({ queryKey: queryKeys.matches }); },
    );
  }, [myId]);
}
