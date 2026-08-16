import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';
import { useOptimisticScoreBump } from './useOptimisticScoreBump';
import type { components } from '../lib/api/api.generated';
import { queryKeys } from '../lib/api/queryKeys';

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  // Only ever set on an optimistic (locally-originated) message. Anything
  // that came back from the server or a realtime broadcast is implicitly
  // 'sent' — there's no ambiguity about whether it was delivered.
  status?: 'sending' | 'sent' | 'failed';
}

function parseMessage(m: components['schemas']['MessageResponse']): Message {
  return {
    id: m.id ?? '',
    matchId: m.matchId ?? '',
    senderId: m.senderId ?? '',
    content: m.content ?? '',
    createdAt: m.createdAt ?? new Date().toISOString(),
    status: 'sent',
  };
}

export function useChat(matchId: string) {
  const qc = useQueryClient();
  // Reads straight from the app's own auth store instead of
  // supabase.auth.getUser() — that call goes through supabase-js's internal
  // call coordination, which has been observed to hang indefinitely and
  // unpredictably on React Native (see hooks/useAuth.ts's
  // AUTH_CALL_TIMEOUT_MS comment). useAuthStore's session is already the
  // app's single source of truth and is synchronous, so there's no reason to
  // ask the SDK again for something this cheap.
  const myId = useAuthStore((s) => s.session?.user.id);
  const bumpScore = useOptimisticScoreBump();

  const { data: messages = [], isLoading: loading } = useQuery<Message[]>({
    queryKey: queryKeys.messages(matchId),
    queryFn: async () => {
      const data = await apiClient.messages.list(matchId);
      return data.map(parseMessage);
    },
    enabled: !!matchId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (!matchId) return;
    // Broadcast, not postgres_changes — the engine's messages table lives in
    // local Postgres now, which Supabase Realtime's postgres_changes can't see
    // (it only observes Supabase's own hosted Postgres via WAL). The engine
    // explicitly pushes a broadcast to this same topic after every send.
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on('broadcast', { event: 'INSERT' }, (msg) => {
        const incoming = parseMessage(msg.payload as components['schemas']['MessageResponse']);
        qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) => {
          const existing = old ?? [];
          if (existing.some((m) => m.id === incoming.id)) return existing;
          return [...existing, incoming];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  async function attemptSend(tempId: string, content: string): Promise<void> {
    try {
      const res = await apiClient.messages.send(matchId, content);
      const sent = parseMessage(res.message ?? {});
      qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) => {
        const withoutOptimistic = (old ?? []).filter((m) => m.id !== tempId);
        if (withoutOptimistic.some((m) => m.id === sent.id)) return withoutOptimistic;
        return [...withoutOptimistic, sent];
      });
      // A send can silently award FirstMessage/MatchReply score and/or
      // advance the "Exchange 5 Words" daily quest and the 10-messages
      // milestone server-side — none of that was previously reflected here,
      // so the score/quest-board/trophy-case numbers only caught up once
      // their own staleTime lapsed (up to a minute) instead of instantly.
      if ((res.awarded ?? 0) > 0) bumpScore(res.awarded ?? 0);
      qc.invalidateQueries({ queryKey: queryKeys.quests });
      qc.invalidateQueries({ queryKey: queryKeys.milestones });
    } catch {
      // Mark the optimistic message as failed instead of leaving it looking
      // identical to a delivered one — MessageBubble renders 'failed'
      // distinctly and offers tap-to-retry via retryMessage below.
      qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
        (old ?? []).map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  }

  async function sendMessage(content: string): Promise<void> {
    const tempId = `local-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      matchId,
      senderId: myId ?? 'me',
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) => [...(old ?? []), optimistic]);
    await attemptSend(tempId, content);
  }

  function retryMessage(tempId: string): void {
    const current = qc.getQueryData<Message[]>(queryKeys.messages(matchId)) ?? [];
    const target = current.find((m) => m.id === tempId);
    if (!target || target.status !== 'failed') return;
    qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
      (old ?? []).map((m) => (m.id === tempId ? { ...m, status: 'sending' } : m)));
    void attemptSend(tempId, target.content);
  }

  return { messages, loading, sendMessage, retryMessage, myId };
}
