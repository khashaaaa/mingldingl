import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const INITIAL_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

export interface BroadcastMessage {
  event?: string;
  payload: unknown;
}

export type BroadcastHandlers = Record<string, (msg: BroadcastMessage) => void>;

interface Listener {
  handlers: BroadcastHandlers;
  onReconnected?: () => void;
}

interface Entry {
  topic: string;
  listeners: Set<Listener>;
  channel: RealtimeChannel | null;
  /** Event names already bound on the live channel. */
  bound: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  delay: number;
  isRetry: boolean;
}

/**
 * One channel per topic, shared by every subscriber to it.
 *
 * `supabase.channel(topic)` returns whatever channel is already listed under that topic — and a
 * removed channel stays listed until the server acknowledges the leave. So creating a "fresh"
 * channel right after `removeChannel` handed back the one still leaving, whose `subscribe()` is a
 * no-op on any state but closed, and the subscription died without a word. The same lookup meant
 * two hooks on one topic (three Town Square users, a chat opened twice) silently shared a channel,
 * and the first to unmount removed it from under the others. Hence: a reference count per topic,
 * handler fan-out, removal only at zero, and no new channel until the previous removal has settled.
 */
const entries = new Map<string, Entry>();
const pendingRemovals = new Map<string, Promise<unknown>>();

function dispatch(entry: Entry, event: string, msg: BroadcastMessage): void {
  for (const listener of [...entry.listeners]) {
    const handler = listener.handlers[event];
    if (!handler) continue;
    try {
      handler(msg);
    } catch {
      // One subscriber's failure must not starve the others sharing this channel.
    }
  }
}

function bindEvents(entry: Entry, events: Iterable<string>): void {
  const ch = entry.channel;
  if (!ch) return;
  for (const event of events) {
    if (entry.bound.has(event)) continue;
    entry.bound.add(event);
    // Broadcast bindings may be added after join (only presence/postgres_changes may not).
    ch.on('broadcast', { event }, (msg: BroadcastMessage) => dispatch(entry, event, msg));
  }
}

function allEvents(entry: Entry): Set<string> {
  const events = new Set<string>();
  for (const l of entry.listeners) for (const e of Object.keys(l.handlers)) events.add(e);
  return events;
}

function removeTracked(topic: string, ch: RealtimeChannel): void {
  const result = supabase.removeChannel(ch) as unknown;
  if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
  const settled: Promise<unknown> = (result as Promise<unknown>)
    .catch(() => undefined)
    .finally(() => {
      if (pendingRemovals.get(topic) === settled) pendingRemovals.delete(topic);
    });
  pendingRemovals.set(topic, settled);
}

function isLive(entry: Entry): boolean {
  return entries.get(entry.topic) === entry;
}

function start(entry: Entry): void {
  if (!isLive(entry)) return;
  const pending = pendingRemovals.get(entry.topic);
  if (pending) {
    void pending.then(() => start(entry));
    return;
  }

  const ch = supabase.channel(entry.topic);
  entry.channel = ch;
  entry.bound = new Set();
  bindEvents(entry, allEvents(entry));

  ch.subscribe((status: string) => {
    if (!isLive(entry) || entry.channel !== ch) return;
    if (status === 'SUBSCRIBED') {
      entry.delay = INITIAL_RETRY_DELAY_MS;
      if (entry.isRetry) {
        entry.isRetry = false;
        for (const l of [...entry.listeners]) l.onReconnected?.();
      }
      return;
    }
    // CLOSED reaching a channel we still hold means the server ended it; nothing rejoins a closed
    // channel on its own, so it is retried like any other failure.
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      scheduleRetry(entry);
    }
  });
}

function scheduleRetry(entry: Entry): void {
  if (!isLive(entry) || entry.timer) return;
  const current = entry.channel;
  entry.channel = null;
  if (current) removeTracked(entry.topic, current);
  const wait = entry.delay;
  entry.delay = Math.min(entry.delay * 2, MAX_RETRY_DELAY_MS);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    entry.isRetry = true;
    start(entry);
  }, wait);
}

/**
 * Subscribes `handlers` (broadcast event name → handler) to `topic`, sharing the topic's channel
 * with any other subscriber. `onReconnected` runs after a failed channel has been re-established,
 * so callers can refetch whatever they may have missed. Returns the unsubscribe function.
 */
export function subscribeToBroadcast(
  topic: string,
  handlers: BroadcastHandlers,
  onReconnected?: () => void,
): () => void {
  const listener: Listener = { handlers, onReconnected };
  let entry = entries.get(topic);
  if (!entry) {
    entry = {
      topic,
      listeners: new Set([listener]),
      channel: null,
      bound: new Set(),
      timer: null,
      delay: INITIAL_RETRY_DELAY_MS,
      isRetry: false,
    };
    entries.set(topic, entry);
    start(entry);
  } else {
    entry.listeners.add(listener);
    bindEvents(entry, Object.keys(handlers));
  }

  const owned = entry;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owned.listeners.delete(listener);
    if (owned.listeners.size > 0 || !isLive(owned)) return;
    entries.delete(topic);
    if (owned.timer) {
      clearTimeout(owned.timer);
      owned.timer = null;
    }
    if (owned.channel) {
      const ch = owned.channel;
      owned.channel = null;
      removeTracked(topic, ch);
    }
  };
}

/** Test-only: forget every topic without touching any channel. */
export function __resetRealtimeRegistryForTests(): void {
  for (const e of entries.values()) if (e.timer) clearTimeout(e.timer);
  entries.clear();
  pendingRemovals.clear();
}
