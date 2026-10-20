import { type HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { AppState, type AppStateStatus } from 'react-native';
import { API_URL } from '../api/config';
import { queryClient } from '../query';
import { onSignedOut, refreshOnce, session, signOutLocally } from '../session';
import { applyLiveEvent, type LiveEvent, refetchActiveOnce } from './events';
import { roadDown, roadUp } from './road';

const STOP_AFTER_BACKGROUND_MS = 5 * 60_000;
const REFETCH_AFTER_BACKGROUND_MS = 30_000;
const BACKOFF = [0, 2_000, 5_000, 10_000];

let connection: HubConnection | null = null;
let backgroundedAt: number | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

async function token(): Promise<string> {
  if (!session.fresh()) await refreshOnce().catch(() => undefined);
  return session.get()?.accessToken ?? '';
}

/** One SignalR connection while signed in; it never gives up reconnecting (30 s steps after the first few). */
export async function startLive() {
  if (connection || session.status() !== 'present') return;
  const c = new HubConnectionBuilder()
    .withUrl(`${API_URL}/live`, { accessTokenFactory: token })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (ctx) => BACKOFF[ctx.previousRetryCount] ?? 30_000,
    })
    // Critical only: a failed start or reconnect while offline is expected and retried below, and
    // at Warning each one reached console.error (a LogBox in development).
    .configureLogging(LogLevel.Critical)
    .build();
  c.on('event', (e: LiveEvent) => applyLiveEvent(queryClient, e, signOutLocally));
  c.onreconnecting(roadDown);
  c.onreconnected(() => {
    roadUp();
    refetchActiveOnce(queryClient);
  });
  connection = c;
  try {
    await c.start();
    roadUp();
  } catch {
    // Offline at start: try again in a moment; automatic reconnect only covers a dropped connection.
    connection = null;
    roadDown();
    setTimeout(startLive, 5_000);
  }
}

async function stopLive() {
  const c = connection;
  connection = null;
  roadUp();
  await c?.stop().catch(() => undefined);
}

function onAppState(next: AppStateStatus) {
  if (next === 'background') {
    backgroundedAt = Date.now();
    stopTimer = setTimeout(stopLive, STOP_AFTER_BACKGROUND_MS);
    return;
  }
  if (next !== 'active') return;
  if (stopTimer) clearTimeout(stopTimer);
  const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
  backgroundedAt = null;
  if (!session.fresh()) refreshOnce().catch(() => undefined);
  if (!connection) startLive().then(() => refetchActiveOnce(queryClient));
  else if (away >= REFETCH_AFTER_BACKGROUND_MS) refetchActiveOnce(queryClient);
}

AppState.addEventListener('change', onAppState);
onSignedOut(() => {
  stopLive();
});
