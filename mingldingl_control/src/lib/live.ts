import { type HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { API_URL } from './api/config';
import {
  adminListUsers,
  getAdminAuditQueryKey,
  getAdminGetConfigQueryKey,
  getAdminGetUserQueryKey,
  getAdminListBarredQueryKey,
  getAdminListGatheringsQueryKey,
  getAdminListThreadsQueryKey,
  getAdminUserPaymentsQueryKey,
} from './api/generated/engine';
import type { AdminUserPage } from './api/generated/model';
import { queryClient } from './query';
import { session } from './session';

/** What the engine pushes: which kind of thing changed and the ids it concerns — never the data. */
export type LiveEvent = { kind: string; ids: string[] };

export type UsersListKey = readonly ['/admin/users', 'pages', { search: string }];
export const usersListKey = (search: string): UsersListKey => ['/admin/users', 'pages', { search }];

const BACKOFF = [0, 2_000, 5_000, 10_000];

/** A new sign-up: fetch each cached list's first page again and put the rows it lacks on top. */
async function prependNewRows(client: QueryClient) {
  const lists = client.getQueriesData<InfiniteData<AdminUserPage, string | null>>({
    queryKey: ['/admin/users', 'pages'],
  });
  await Promise.all(
    lists.map(async ([key, data]) => {
      if (!data) return;
      const { search } = (key as UsersListKey)[2];
      const fresh = await adminListUsers({ search: search || undefined }).catch(() => null);
      if (!fresh) return;
      client.setQueryData<InfiniteData<AdminUserPage, string | null>>(key, (old) => {
        if (!old) return old;
        const seen = new Set(old.pages.flatMap((p) => p.items.map((r) => r.accountId)));
        const added = fresh.items.filter((r) => !seen.has(r.accountId));
        if (added.length === 0) return old;
        const [first, ...rest] = old.pages;
        return { ...old, pages: [{ ...first, items: [...added, ...first.items] }, ...rest] };
      });
    }),
  );
}

const touchesToday = (q: { queryKey: readonly unknown[] }) =>
  typeof q.queryKey[0] === 'string' &&
  (q.queryKey[0].startsWith('/admin/dashboard') || q.queryKey[0].startsWith('/admin/deletions'));

function applyLiveEvent(client: QueryClient, e: LiveEvent) {
  // The dashboard's today and the fading list move with sign-ups, reports, payments and bonds.
  if (['user.created', 'user.updated', 'report.created', 'payment.updated'].includes(e.kind))
    client.invalidateQueries({ predicate: touchesToday });
  switch (e.kind) {
    case 'user.created':
      return prependNewRows(client);
    case 'user.updated':
      for (const id of e.ids) {
        client.invalidateQueries({ queryKey: getAdminGetUserQueryKey(id) });
        client.invalidateQueries({ queryKey: getAdminUserPaymentsQueryKey(id) });
      }
      return client.invalidateQueries({ queryKey: ['/admin/users', 'pages'] });
    case 'report.created':
      // also sent when a report is decided
      return client.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('/admin/reports'),
      });
    case 'venue.updated':
      return client.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('/admin/venues'),
      });
    case 'audit.created':
      return client.invalidateQueries({ queryKey: getAdminAuditQueryKey() });
    case 'square.updated':
      return client.invalidateQueries({ queryKey: getAdminListGatheringsQueryKey() });
    case 'thread.updated':
      return client.invalidateQueries({ queryKey: getAdminListThreadsQueryKey() });
    case 'payment.updated':
      return client.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' &&
          (q.queryKey[0].startsWith('/admin/payments') ||
            q.queryKey[0].startsWith('/admin/invoices') ||
            q.queryKey[0].endsWith('/payments')),
      });
    case 'config.updated':
      return client.invalidateQueries({ queryKey: getAdminGetConfigQueryKey() });
    case 'barred.changed':
      return client.invalidateQueries({ queryKey: getAdminListBarredQueryKey() });
  }
}

let connection: HubConnection | null = null;

export type LiveState = 'off' | 'connecting' | 'live' | 'reconnecting';
let state: LiveState = 'off';
const stateListeners = new Set<() => void>();
function setState(next: LiveState) {
  state = next;
  for (const l of stateListeners) l();
}
/** For useSyncExternalStore: the shell shows whether the panel is live. */
export const liveState = {
  get: () => state,
  subscribe(l: () => void) {
    stateListeners.add(l);
    return () => stateListeners.delete(l);
  },
};

/** One SignalR connection while a keeper is signed in; it never stops trying to reconnect. */
export async function startLive() {
  if (connection || !session.token()) return;
  const c = new HubConnectionBuilder()
    .withUrl(`${API_URL}/admin/live`, {
      accessTokenFactory: () => session.token() ?? '',
      // bearer token, no cookies: a credentialed request is refused by a wildcard-origin CORS policy
      withCredentials: false,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (ctx) => BACKOFF[ctx.previousRetryCount] ?? 30_000,
    })
    .configureLogging(LogLevel.Warning)
    .build();
  c.on('event', (e: LiveEvent) => applyLiveEvent(queryClient, e));
  // Events missed while disconnected are gone: show the current truth once.
  c.onreconnecting(() => setState('reconnecting'));
  c.onreconnected(() => {
    setState('live');
    queryClient.refetchQueries({ type: 'active' });
  });
  c.onclose(() => {
    if (connection === c) setState('off');
  });
  connection = c;
  setState('connecting');
  try {
    await c.start();
    if (connection === c) setState('live');
  } catch {
    if (connection !== c) return;
    connection = null;
    setState('reconnecting');
    setTimeout(startLive, 5_000);
  }
}

async function stopLive() {
  const c = connection;
  connection = null;
  setState('off');
  await c?.stop().catch(() => undefined);
}

session.subscribe(() => {
  if (session.get()) startLive();
  else stopLive();
});
