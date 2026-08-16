import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '../lib/api/queryClient';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import type { Match } from '../models/match';

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

    // Broadcast, not postgres_changes — see useChat.ts for why. The engine
    // pushes each of these explicitly (MessagesController, EngagementController,
    // ActivityService) after the triggering write succeeds.
    const channel = supabase
      .channel('app-nudges')
      .on('broadcast', { event: 'icebreaker' }, (msg) => {
        const { userId, matchId } = msg.payload as { userId: string; matchId: string };
        if (userId === myId) return;
        setPendingNudge({
          icon: '🧊',
          title: i18n.t('nudge_icebreaker_answered', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'quiz' }, (msg) => {
        const { userId, matchId } = msg.payload as { userId: string; matchId: string | null };
        if (!matchId || userId === myId) return;
        setPendingNudge({
          icon: '🎯',
          title: i18n.t('nudge_quiz_answered', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'date_confirmed' }, (msg) => {
        const { matchId } = msg.payload as { matchId: string };
        setPendingNudge({
          icon: '📍',
          title: i18n.t('nudge_date_confirmed', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .on('broadcast', { event: 'message' }, (msg) => {
        const { senderId, matchId } = msg.payload as { senderId: string; matchId: string };
        if (senderId === myId) return;
        if (matchId === useAuthStore.getState().activeChatMatchId) return;
        setPendingNudge({
          icon: '💬',
          title: i18n.t('nudge_new_message', { name: otherUserName(matchId) }),
          matchId,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);
}
