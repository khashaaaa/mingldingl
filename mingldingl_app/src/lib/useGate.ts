import Constants from 'expo-constants';
import { useEffect } from 'react';
import { useGetAppStatus, useGetMe } from './api/generated/engine';
import { type Belongs, whereBelongs } from './gate';
import { chooseLocale } from './i18n/device';
import { startLive } from './live/connection';
import { boot, useSessionStatus } from './session';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Session + /me + /app/status → where this person belongs. Live events keep both queries current. */
export function useGate(): Belongs {
  const session = useSessionStatus();
  useEffect(() => {
    if (session === 'unknown') boot();
  }, [session]);
  const app = useGetAppStatus();
  const me = useGetMe({ query: { enabled: session === 'present' } });
  // Signed in, the profile's language travels: a new phone (or one left in the other language)
  // speaks it, so the screen and what the engine writes agree.
  const spoken = session === 'present' ? me.data?.profile?.locale : undefined;
  useEffect(() => {
    if (spoken === 'en' || spoken === 'mn') chooseLocale(spoken);
  }, [spoken]);
  return whereBelongs({
    session,
    me: session === 'present' ? me.data : undefined,
    app: app.data,
    appVersion: APP_VERSION,
  });
}

/** Keeps the live connection open exactly while a session exists. */
export function useLiveWhileSignedIn() {
  const s = useSessionStatus();
  useEffect(() => {
    if (s === 'present') startLive();
  }, [s]);
}
