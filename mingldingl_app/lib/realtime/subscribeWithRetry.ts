import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const INITIAL_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

export function subscribeWithRetry(
  createChannel: () => RealtimeChannel,
  onReconnected?: () => void,
): () => void {
  let stopped = false;
  let delay = INITIAL_RETRY_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let channel: RealtimeChannel | null = null;
  let isRetry = false;

  function start(): void {
    if (stopped) return;
    const ch = createChannel();
    channel = ch;
    ch.subscribe((status) => {
      if (stopped || channel !== ch) return;
      if (status === 'SUBSCRIBED') {
        delay = INITIAL_RETRY_DELAY_MS;
        if (isRetry) {
          isRetry = false;
          onReconnected?.();
        }
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        scheduleRetry();
      }
    });
  }

  function scheduleRetry(): void {
    if (stopped || timer) return;
    const current = channel;
    channel = null;
    if (current) supabase.removeChannel(current);
    const wait = delay;
    delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    timer = setTimeout(() => {
      timer = null;
      isRetry = true;
      start();
    }, wait);
  }

  start();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}
