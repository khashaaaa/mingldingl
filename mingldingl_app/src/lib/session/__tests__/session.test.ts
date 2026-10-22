import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../../api/client';
import {
  boot,
  onRefreshedMe,
  onSignedOut,
  REFRESH_KEY,
  refreshOnce,
  session,
  signIn,
  signOutLocally,
} from '../index';

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let handler: (url: string, init: RequestInit) => Promise<Response> | Response;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pair = (n: number, expiresInMs = 15 * 60_000) => ({
  accessToken: `access-${n}`,
  accessExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  refreshToken: `refresh-${n}`,
  accountId: 'acc-1',
});

beforeEach(async () => {
  calls.length = 0;
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  }) as typeof fetch;
  await signOutLocally();
});

const refreshCalls = () => calls.filter((c) => c.url.endsWith('/auth/refresh')).length;

test('concurrent 401s share one refresh and all succeed', async () => {
  await signIn(pair(1));
  handler = async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      await new Promise((r) => setTimeout(r, 20));
      return json(200, pair(2));
    }
    const auth = new Headers(init.headers).get('Authorization');
    return auth === 'Bearer access-2' ? json(200, { ok: true }) : json(401, { code: 'unauthorized' });
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => apiFetch<{ ok: boolean }>('/me', {})));
  expect(results.every((r) => r.ok)).toBe(true);
  expect(refreshCalls()).toBe(1);
  expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('refresh-2');
});

test('network failure during refresh does not sign out', async () => {
  await signIn(pair(1, 0));
  const signedOut = jest.fn();
  const off = onSignedOut(signedOut);
  handler = () => {
    throw new TypeError('Network request failed');
  };
  await expect(apiFetch('/me', {})).rejects.toMatchObject({ kind: 'network' });
  expect(signedOut).not.toHaveBeenCalled();
  expect(session.status()).toBe('present');
  expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('refresh-1');
  off();
});

test('a revoked refresh signs out once and clears everything', async () => {
  await signIn(pair(1, 0));
  const signedOut = jest.fn();
  const off = onSignedOut(signedOut);
  handler = (url) => (url.endsWith('/auth/refresh') ? json(401, { code: 'auth.revoked' }) : json(200, {}));
  await expect(Promise.all([apiFetch('/me', {}), apiFetch('/me/photos', {})])).rejects.toMatchObject({
    kind: 'signed-out',
  });
  expect(signedOut).toHaveBeenCalledTimes(1);
  expect(session.status()).toBe('none');
  expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
  off();
});

test('a token expiring within 60 s is refreshed before the request', async () => {
  await signIn(pair(1, 30_000));
  handler = (url) => (url.endsWith('/auth/refresh') ? json(200, pair(2)) : json(200, { ok: true }));
  await apiFetch('/me', {});
  expect(refreshCalls()).toBe(1);
  expect(new Headers(calls.at(-1)?.init.headers).get('Authorization')).toBe('Bearer access-2');
});

test('the retry happens once; a second 401 surfaces as an error', async () => {
  await signIn(pair(1));
  handler = (url) =>
    url.endsWith('/auth/refresh') ? json(200, pair(2)) : json(401, { code: 'unauthorized' });
  await expect(apiFetch('/me', {})).rejects.toMatchObject({ status: 401 });
  expect(refreshCalls()).toBe(1);
});

test('boot with no stored token is signed out; with one it refreshes', async () => {
  await boot();
  expect(session.status()).toBe('none');
  await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-9');
  handler = () => json(200, pair(10));
  await boot();
  expect(session.status()).toBe('present');
  expect(session.get()?.accessToken).toBe('access-10');
});

test('boot offline keeps the stored session', async () => {
  await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-9');
  handler = () => {
    throw new TypeError('Network request failed');
  };
  await boot();
  expect(session.status()).toBe('present');
});

test('refreshOnce returns signed-out without a stored token', async () => {
  expect(await refreshOnce()).toBe('signed-out');
});

test('a refresh hands who you are to the cache before the session turns present, and a write names itself', async () => {
  await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
  const me = {
    accountId: 'acc-1',
    status: 'Active',
    profile: null,
    onboardingStep: 1,
    phoneHint: '9911',
    deleteAt: null,
  };
  let statusWhenSeeded: string | null = null;
  const off = onRefreshedMe((m) => {
    statusWhenSeeded = session.status();
    expect(m).toEqual(me);
  });
  handler = (url) =>
    url.endsWith('/auth/refresh') ? json(200, { ...pair(2), me }) : json(200, { ok: true });
  await refreshOnce();
  expect(statusWhenSeeded).not.toBe('present');
  expect(session.get()).toMatchObject({ accessToken: 'access-2' });
  off();

  await apiFetch('/me/bio', { method: 'POST', body: '{}' });
  await apiFetch('/me', {});
  const [write, read] = calls.slice(-2);
  expect(new Headers(write?.init.headers).get('X-Live-Origin')).toMatch(/^[a-z0-9-]+$/);
  expect(new Headers(read?.init.headers).get('X-Live-Origin')).toBeNull();
});
