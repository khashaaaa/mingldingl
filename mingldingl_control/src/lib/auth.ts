// Admin JWT storage — plain localStorage, acceptable for a local-only
// internal tool (see design discussion: revisit if this ever gets deployed
// somewhere reachable remotely).
const TOKEN_KEY = 'mingldingl_control_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
