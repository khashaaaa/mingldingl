import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

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
      setPermissionDenied(true);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  return { capture, isCapturing, permissionDenied };
}
