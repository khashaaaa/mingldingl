import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { API_URL } from '../api/config';
import type { MeView } from '../api/generated/model';

/** The engine's SessionPair. The access token lives only in memory; the refresh token in SecureStore. */
export type SessionPair = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  accountId: string;
};
type Current = { accessToken: string | null; accessExpiresAt: number; accountId: string | null };
export type SessionStatus = 'unknown' | 'none' | 'present';

export const REFRESH_KEY = 'mingl.refresh';
const REFRESH_EARLY_MS = 60_000;

let status: SessionStatus = 'unknown';
let current: Current = { accessToken: null, accessExpiresAt: 0, accountId: null };
const listeners = new Set<() => void>();
const signedOutListeners = new Set<() => void>();

const emit = () => {
  for (const fn of listeners) fn();
};

export const session = {
  status: () => status,
  get: () => (status === 'present' ? current : null),
  /** True when a request can go out with the token it has. */
  fresh: () => current.accessToken !== null && current.accessExpiresAt - Date.now() > REFRESH_EARLY_MS,
};

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    session.status,
    session.status,
  );
}

const meListeners = new Set<(me: MeView) => void>();

/**
 * /auth/refresh also answers who you are now: the query cache takes it (lib/query) before the
 * session turns present, so a launch needs no second call for /me.
 */
export function onRefreshedMe(fn: (me: MeView) => void): () => void {
  meListeners.add(fn);
  return () => meListeners.delete(fn);
}

/** Registers a cleanup to run once whenever the device is signed out (cache, live connection). */
export function onSignedOut(fn: () => void): () => void {
  signedOutListeners.add(fn);
  return () => signedOutListeners.delete(fn);
}

function apply(pair: SessionPair) {
  current = {
    accessToken: pair.accessToken,
    accessExpiresAt: Date.parse(pair.accessExpiresAt),
    accountId: pair.accountId,
  };
  if (status !== 'present') {
    status = 'present';
    emit();
  }
}

export async function signIn(pair: SessionPair) {
  await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken);
  apply(pair);
}

/** One clean step: memory, SecureStore, then every registered cleanup. Idempotent. */
export async function signOutLocally() {
  const wasSignedIn = status === 'present';
  current = { accessToken: null, accessExpiresAt: 0, accountId: null };
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  if (status !== 'none') {
    status = 'none';
    emit();
  }
  if (wasSignedIn) for (const fn of signedOutListeners) fn();
}

class NetworkError extends Error {
  readonly kind = 'network';
}

let inFlight: Promise<SessionPair | 'signed-out'> | null = null;

/**
 * Single flight: every caller that needs a new token shares one /auth/refresh. Only a refusal
 * (401) signs out; a network failure leaves the session in place to try again later.
 */
export function refreshOnce(): Promise<SessionPair | 'signed-out'> {
  inFlight ??= (async () => {
    const token = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!token) {
      await signOutLocally();
      return 'signed-out' as const;
    }
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
    } catch (e) {
      throw new NetworkError(String(e));
    }
    if (res.status === 401) {
      await signOutLocally();
      return 'signed-out' as const;
    }
    if (!res.ok) throw new NetworkError(`refresh ${res.status}`);
    const { me, ...pair } = (await res.json()) as SessionPair & { me?: MeView };
    if (me) for (const fn of meListeners) fn(me);
    await signIn(pair);
    return pair;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** At launch: no stored token → signed out; otherwise refresh (offline keeps the session). */
export async function boot() {
  const token = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!token) {
    status = 'none';
    emit();
    return;
  }
  try {
    await refreshOnce();
  } catch {
    status = 'present';
    emit();
  }
}
