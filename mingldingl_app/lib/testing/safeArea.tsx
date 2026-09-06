import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** A notched phone: enough top and bottom inset that a missing inset shows up as a diff. */
export const SAFE_AREA_FRAME = { x: 0, y: 0, width: 390, height: 844 };
export const SAFE_AREA_INSETS = { top: 47, left: 0, right: 0, bottom: 34 };

/**
 * `useSafeAreaInsets` throws outside a provider, so any screen reaching for an inset — every
 * scrollable screen does now, via `useScrollTail` — needs one in tests.
 */
export function WithSafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: SAFE_AREA_FRAME, insets: SAFE_AREA_INSETS }}>
      {children}
    </SafeAreaProvider>
  );
}
