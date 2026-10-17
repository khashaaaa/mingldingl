import { session } from '../session';
import { API_URL } from './config';

/** A refused request, already sorted: show `message` for a rule; `auth` has signed the keeper out. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The Orval mutator: every generated call goes through here. A 401 ends the session (back to login). */
export const adminFetch = async <T>(url: string, init: RequestInit): Promise<T> => {
  const headers = new Headers(init.headers);
  const token = session.token();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, 'network', `The engine cannot be reached (${String(e)})`);
  }
  if (res.status === 401 && token) session.clear();
  if (res.status === 204) return undefined as T;
  const body = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
  if (res.ok) return body as T;
  const b = body as { code?: string; message?: string } | null;
  throw new ApiError(
    res.status,
    b?.code ?? `http.${res.status}`,
    b?.message ?? `Request failed (${res.status})`,
  );
};

/** What a screen shows for any failure: the engine's own message for a refused rule. */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
