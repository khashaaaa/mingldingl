import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

// `isInternetReachable` is only meaningful on iOS/well-supported Android
// versions (see expo-network's own docs) — `undefined` there doesn't mean
// "offline", it means "unknown", so treat it as reachable unless it's an
// explicit `false`. `isConnected` alone (no active radio/interface at all)
// is the one signal that's unambiguous everywhere.
function isOnline(state: Network.NetworkState): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

// No screen in this app checked connectivity before this hook existed — a
// dead connection just made every query silently fail or hang, with no
// signal to the player that anything was wrong (see globalErrorHandler.ts's
// own gap: it only catches thrown/rejected errors, not "the request never
// even got a response"). Event-driven via addNetworkStateListener, with an
// initial getNetworkStateAsync() call since the listener only fires on a
// *change*, not on mount.
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync().then((state) => {
      if (mounted) setOnline(isOnline(state));
    }).catch(() => {});

    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isOnline(state));
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return online;
}
