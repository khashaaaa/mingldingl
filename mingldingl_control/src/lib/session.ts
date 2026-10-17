/** The admin token lives in sessionStorage: one tab, gone when the tab closes, 12 h at most. */
const KEY = 'keeper.session';

export type AdminSession = { token: string; expiresAt: string };

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as AdminSession) : null;
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

let current = read();

function emit() {
  for (const l of listeners) l();
}

export const session = {
  get: () => current,
  token: () => (current && Date.parse(current.expiresAt) > Date.now() ? current.token : null),
  set(s: AdminSession) {
    current = s;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // private mode: the session still lasts until reload
    }
    emit();
  },
  clear() {
    if (!current) return;
    current = null;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
    emit();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
