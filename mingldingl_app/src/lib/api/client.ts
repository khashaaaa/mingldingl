import { beginWrite, ORIGIN_HEADER } from '../live/writes';
import { refreshOnce, session } from '../session';
import { API_URL } from './config';

export type ApiErrorKind = 'rule' | 'auth' | 'network' | 'signed-out' | 'server';

/** Every failure a screen can meet, already sorted: show `message` for a rule, retry for network. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function ensureToken(): Promise<string | null> {
  if (session.status() !== 'present') return null;
  if (session.fresh()) return session.get()?.accessToken ?? null;
  try {
    const r = await refreshOnce();
    if (r === 'signed-out') throw new ApiError('signed-out', 401, 'auth.signed_out', 'Signed out');
    return r.accessToken;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('network', 0, 'network', String(e));
  }
}

async function send(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  try {
    return await fetch(`${API_URL}${url}`, { ...init, headers });
  } catch (e) {
    throw new ApiError('network', 0, 'network', String(e));
  }
}

/**
 * The Orval mutator: every generated call goes through here. A write carries its own name
 * (X-Live-Origin), so the live echo it causes can wait for its answer (lib/live/writes).
 */
export const apiFetch = async <T>(url: string, init: RequestInit): Promise<T> => {
  if (!init.method || init.method.toUpperCase() === 'GET') return call<T>(url, init);
  const write = beginWrite();
  const headers = new Headers(init.headers);
  headers.set(ORIGIN_HEADER, write.id);
  try {
    return await call<T>(url, { ...init, headers });
  } finally {
    write.end();
  }
};

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let token = await ensureToken();
  let res = await send(url, init, token);
  if (res.status === 401 && token) {
    // The engine refused the token (expired or revoked): one shared refresh, one retry.
    const r = await refreshOnce().catch((e) => {
      throw new ApiError('network', 0, 'network', String(e));
    });
    if (r === 'signed-out') throw new ApiError('signed-out', 401, 'auth.signed_out', 'Signed out');
    token = r.accessToken;
    res = await send(url, init, token);
  }
  // No content is null, never undefined: a query may not resolve to undefined (TanStack throws).
  if (res.status === 204) return null as T;
  const body = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
  if (res.ok) return body as T;
  const code = (body as { code?: string } | null)?.code ?? `http.${res.status}`;
  const message = (body as { message?: string } | null)?.message ?? `Request failed (${res.status})`;
  const kind: ApiErrorKind = res.status === 401 ? 'auth' : res.status >= 500 ? 'server' : 'rule';
  throw new ApiError(kind, res.status, code, message);
}
