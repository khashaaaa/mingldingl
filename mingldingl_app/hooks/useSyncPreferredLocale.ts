import { useEffect } from 'react';
import { apiClient } from '../lib/api/apiClient';

/**
 * Keeps the engine's copy of the user's language in step with the app's, so push notifications
 * arrive in the language the app is showing. Fires once per locale change, and only after the
 * profile has loaded so a fresh install does not race the account creation. Failures are
 * swallowed: the next locale change (or app start) retries, and a stale push language is not
 * worth an error surface.
 */
export function useSyncPreferredLocale(locale: string, storedLocale: string | undefined): void {
  useEffect(() => {
    if (storedLocale === undefined || storedLocale === locale) return;
    apiClient.users.update({ preferredLocale: locale }).catch(() => {});
  }, [locale, storedLocale]);
}
