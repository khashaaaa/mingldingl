import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Refetches whenever the screen comes back into focus — never on the first focus, which the query
 * itself already fetches for.
 *
 * Tab screens stay mounted, so without this a list read once is the list shown until the app
 * restarts. It stands in for pull-to-refresh, which these screens no longer have: returning to a
 * screen is the refresh.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  const latest = useRef(refetch);
  latest.current = refetch;
  useFocusEffect(useCallback(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current();
  }, []));
}
