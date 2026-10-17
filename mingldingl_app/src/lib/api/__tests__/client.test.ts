import { signIn, signOutLocally } from '../../session';
import { ApiError, apiFetch } from '../client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await signOutLocally();
  await signIn({
    accessToken: 'a',
    accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'r',
    accountId: 'x',
  });
});

test('engine errors arrive as ApiError with code and message', async () => {
  global.fetch = jest.fn(async () =>
    json(409, { code: 'profile.exists', message: 'Your character already exists' }),
  ) as typeof fetch;
  const e = (await apiFetch('/me', { method: 'POST' }).catch((x) => x)) as ApiError;
  expect(e).toBeInstanceOf(ApiError);
  expect(e).toMatchObject({
    status: 409,
    code: 'profile.exists',
    message: 'Your character already exists',
    kind: 'rule',
  });
});

test('requests go to the configured engine with a bearer and JSON body', async () => {
  const f = jest.fn(async () => json(200, { ok: 1 }));
  global.fetch = f as typeof fetch;
  await apiFetch('/me', { method: 'PUT', body: JSON.stringify({ bio: 'x' }) });
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/\/me$/);
  const h = new Headers(init.headers);
  expect(h.get('Authorization')).toBe('Bearer a');
  expect(h.get('Content-Type')).toBe('application/json');
});

test('204 resolves to null', async () => {
  global.fetch = jest.fn(async () => new Response(null, { status: 204 })) as typeof fetch;
  await expect(apiFetch('/auth/sign-out', { method: 'POST' })).resolves.toBeNull();
});

test('public endpoints work signed out', async () => {
  await signOutLocally();
  const f = jest.fn(async () => json(200, { minVersion: '1.0.0', maintenance: false }));
  global.fetch = f as typeof fetch;
  await apiFetch('/app/status', {});
  const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(new Headers(init.headers).has('Authorization')).toBe(false);
});
