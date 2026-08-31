export const TOKEN_KEY = 'mingldingl_control_admin_token';
const EXPIRES_KEY = 'mingldingl_control_admin_token_expires';

const EXPIRY_SKEW_MS = 60 * 1000;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, expiresAt?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) localStorage.setItem(EXPIRES_KEY, expiresAt);
  else localStorage.removeItem(EXPIRES_KEY);
}

export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return ts - EXPIRY_SKEW_MS <= Date.now();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}
