import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const matchId = notification.request.content.data?.matchId as string | undefined;
    const viewingThisChat = !!matchId && useAuthStore.getState().activeChatMatchId === matchId;
    return {
      shouldShowAlert: !viewingThisChat,
      shouldPlaySound: !viewingThisChat,
      shouldSetBadge: true,
      shouldShowBanner: !viewingThisChat,
      shouldShowList: true,
    };
  },
});

/**
 * The engine tags every push with a `type`. Routing every one of them to the chat sent a Flame
 * Rite proposal — whose whole point is the video screen — to the wrong place; unknown types
 * still fall back to the chat, which is where a match or a message belongs.
 */
export function destinationFor(type: string | undefined, matchId: string): `/video/${string}` | `/chat/${string}` {
  switch (type) {
    case 'flame_rite_proposed':
      return `/video/${matchId}`;
    default:
      return `/chat/${matchId}`;
  }
}

export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    async function register() {
      if (!Device.isDevice) return;
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted' || cancelled) return;

      let token: string;
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch {
        return;
      }
      if (cancelled) return;
      await apiClient.push.register(token, Platform.OS).catch(() => {});
    }

    register();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const matchId = data?.matchId as string | undefined;
      if (!matchId) return;
      router.push(destinationFor(data?.type as string | undefined, matchId));
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
