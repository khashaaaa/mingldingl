import { API_URL } from '../../lib/api/config';

/** The web page's own token: half an hour, this tab only, reaches only /guild. */
const KEY = 'guild.session';
type Held = { token: string; expiresAt: string; name: string };

export const guildSession = {
  get(): Held | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Held) : null;
      return s && Date.parse(s.expiresAt) > Date.now() ? s : null;
    } catch {
      return null;
    }
  },
  set(s: Held) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // private mode: it lasts until reload
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
  },
};

export class GuildError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The Orval mutator for the guild page. A 401 means the half hour is over: sign in again. */
export const guildFetch = async <T>(url: string, init: RequestInit): Promise<T> => {
  const headers = new Headers(init.headers);
  const token = guildSession.get()?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, { ...init, headers });
  } catch (e) {
    throw new GuildError(0, 'network', `The road is cut (${String(e)})`);
  }
  if (res.status === 401) guildSession.clear();
  if (res.status === 204) return undefined as T;
  const body = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
  if (res.ok) return body as T;
  const b = body as { code?: string; message?: string } | null;
  throw new GuildError(
    res.status,
    b?.code ?? `http.${res.status}`,
    b?.message ?? `Request failed (${res.status})`,
  );
};
