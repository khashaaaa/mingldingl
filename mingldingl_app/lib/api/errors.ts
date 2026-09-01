import { isAxiosError } from 'axios';
import { i18n } from '../i18n';

/**
 * The engine returns `{ error, code }`. `error` is developer-facing English written for logs and
 * is never translated — showing it put a bare English sentence in front of a Mongolian user at
 * the exact moment something had already gone wrong. `code` is stable, so the copy lives here.
 *
 * A code with no entry falls back to the caller's own message rather than the server's, which
 * means a newly added server error degrades to something localised instead of leaking English.
 */
export function apiErrorCode(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  const data = err.response?.data as { code?: string } | undefined;
  return data?.code ?? null;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const code = apiErrorCode(err);
  if (code) {
    const key = `err_${code.replace(/\./g, '_')}`;
    const translated = i18n.t(key);
    // i18n-js returns its own marker string for a key it does not have.
    if (!translated.startsWith('[missing')) return translated;
  }
  return fallback;
}

/** True when the failure carries this exact engine error code. */
export function isApiError(err: unknown, code: string): boolean {
  return apiErrorCode(err) === code;
}
