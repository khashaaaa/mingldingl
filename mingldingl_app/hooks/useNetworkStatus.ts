import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

function isOnline(state: Network.NetworkState): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

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
