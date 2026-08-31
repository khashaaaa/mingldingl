import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { subscribeWithRetry } from '../lib/realtime/subscribeWithRetry';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';
import type { components } from '../lib/api/api.generated';
import { queryKeys } from '../lib/api/queryKeys';

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;

  status?: 'sending' | 'sent' | 'failed';
}

export function mergeMessages(serverOrBase: Message[], extras: Message[]): Message[] {
  const seen = new Set(serverOrBase.map((m) => m.id));
  const merged = [...serverOrBase];
  for (const m of extras) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }
  return merged;
}

export const MESSAGE_PAGE_SIZE = 50;

let tempIdCounter = 0;

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

export function oldestServerMessage(messages: Message[]): Message | undefined {
  let oldest: Message | undefined;
  for (const m of messages) {
    if (m.status !== 'sent') continue;
    if (!oldest || m.createdAt < oldest.createdAt) oldest = m;
  }
  return oldest;
}

export function useChat(matchId: string) {
  const qc = useQueryClient();

  const myId = useAuthStore((s) => s.session?.user.id);
  const [earlierExhausted, setEarlierExhausted] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  useEffect(() => {
    setEarlierExhausted(false);
  }, [matchId]);

  const { data: messages = [], isLoading: loading, isError, refetch } = useQuery<Message[]>({
    queryKey: queryKeys.messages(matchId),
    queryFn: async () => {
      const data = await apiClient.messages.list(matchId, { limit: MESSAGE_PAGE_SIZE });
      if (data.length < MESSAGE_PAGE_SIZE) setEarlierExhausted(true);

      const cached = qc.getQueryData<Message[]>(queryKeys.messages(matchId)) ?? [];
      return mergeMessages(
        data.map(parseMessage),
        cached.filter((m) => m.status === 'sending' || m.status === 'failed'),
      );
    },
    enabled: !!matchId,
    staleTime: 15 * 1000,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (!matchId) return;

    return subscribeWithRetry(
      () => supabase
        .channel(`chat:${matchId}`)
        .on('broadcast', { event: 'INSERT' }, (msg) => {
          const incoming = parseMessage(msg.payload as components['schemas']['MessageResponse']);
          qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
            mergeMessages(old ?? [], [incoming]));
        }),
      () => { qc.invalidateQueries({ queryKey: queryKeys.messages(matchId) }); },
    );
  }, [matchId]);

  const sentCount = messages.reduce((n, m) => (m.status === 'sent' ? n + 1 : n), 0);
  const hasMore = !earlierExhausted && sentCount >= MESSAGE_PAGE_SIZE;

  async function loadEarlier(): Promise<void> {
    if (loadingEarlier || !hasMore) return;
    const oldest = oldestServerMessage(qc.getQueryData<Message[]>(queryKeys.messages(matchId)) ?? []);
    if (!oldest) return;
    setLoadingEarlier(true);
    try {
      const page = await apiClient.messages.list(matchId, { before: oldest.createdAt, limit: MESSAGE_PAGE_SIZE });
      if (page.length < MESSAGE_PAGE_SIZE) setEarlierExhausted(true);
      qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
        mergeMessages(page.map(parseMessage), old ?? []));
    } catch {
    } finally {
      setLoadingEarlier(false);
    }
  }

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiClient.messages.send(matchId, content),
    meta: {
      invalidates: [queryKeys.quests, queryKeys.milestones, queryKeys.matches],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
      silentError: true,
    },
  });

  async function attemptSend(tempId: string, content: string): Promise<void> {
    try {
      const res = await sendMutation.mutateAsync(content);
      const sent = parseMessage(res.message ?? {});
      qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
        mergeMessages((old ?? []).filter((m) => m.id !== tempId), [sent]));
    } catch {
      qc.setQueryData<Message[]>(queryKeys.messages(matchId), (old) =>
        (old ?? []).map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  }

  async function sendMessage(content: string): Promise<void> {
    const tempId = `local-${Date.now()}-${++tempIdCounter}`;
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

  return { messages, loading, isError, refetch, sendMessage, retryMessage, myId, loadEarlier, hasMore, loadingEarlier };
}
