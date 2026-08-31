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
      const matchId = response.notification.request.content.data?.matchId as string | undefined;
      if (matchId) router.push(`/chat/${matchId}`);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
