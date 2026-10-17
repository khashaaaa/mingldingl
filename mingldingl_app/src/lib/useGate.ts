import Constants from 'expo-constants';
import { useEffect } from 'react';
import { useGetAppStatus, useGetMe } from './api/generated/engine';
import { type Belongs, whereBelongs } from './gate';
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
