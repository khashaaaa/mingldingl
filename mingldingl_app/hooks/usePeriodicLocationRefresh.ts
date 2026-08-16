import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { apiClient } from '../lib/api/apiClient';

// Every so often, not continuously — see the 2026-07-27 brainstorm:
// foreground-only capture, no background tracking, no "Always" permission.
// Silently re-snaps City/Latitude/Longitude on the existing user so
// Discover's distance sort stays roughly current as the user travels.
const MIN_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours

export function usePeriodicLocationRefresh(enabled: boolean) {
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    async function refresh() {
      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_INTERVAL_MS) return;
      lastRefreshAt.current = now;
      try {
        // Doesn't (re-)request permission here — if it was never granted (or
        // was revoked), this just no-ops rather than prompting the user
        // outside of the onboarding flow that already asked once.
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await apiClient.users.updateLocation(position.coords.latitude, position.coords.longitude);
      } catch {
        // Best-effort — a stale distance sort until the next successful
        // refresh is a much smaller problem than surfacing this to the user.
      }
    }

    refresh(); // once on mount/session-start

    function onAppStateChange(state: AppStateStatus) {
      if (state === 'active') refresh();
    }
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [enabled]);
}
