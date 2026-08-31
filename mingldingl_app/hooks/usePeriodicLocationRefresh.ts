import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { apiClient } from '../lib/api/apiClient';

const MIN_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6;

export function usePeriodicLocationRefresh(enabled: boolean) {
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    async function refresh() {
      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_INTERVAL_MS) return;
      lastRefreshAt.current = now;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await apiClient.users.updateLocation(position.coords.latitude, position.coords.longitude);
      } catch {
      }
    }

    refresh();

    function onAppStateChange(state: AppStateStatus) {
      if (state === 'active') refresh();
    }
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [enabled]);
}
