import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

// Foreground-only GPS capture — requests "When In Use" permission and takes
// one fix, no background tracking. Balanced accuracy (city-block scale) is
// plenty for snapping to the nearest of ~30 known Mongolia city points and
// for a few-km Discover distance sort; there's no reason to pay Highest
// accuracy's battery cost for that.
export function useLocationCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const capture = useCallback(async (): Promise<Coords | null> => {
    setIsCapturing(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setPermissionDenied(true);
        return null;
      }
      setPermissionDenied(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      // GPS unavailable, timed out, or the OS-level location service is off —
      // treat the same as denial: caller falls back to manual city selection.
      setPermissionDenied(true);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  return { capture, isCapturing, permissionDenied };
}
