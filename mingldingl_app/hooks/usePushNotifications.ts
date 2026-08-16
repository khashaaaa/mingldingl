import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';

// Foreground notifications show a banner by default — suppress it if the
// user is already looking at that exact chat (the realtime NudgeToast
// already covers that case in-app; a push on top would be redundant).
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

// Real OS-level push (APNs/FCM via Expo's push service) — native only.
// There's no background/closed-app equivalent on web, and requesting a
// device push token there would just throw, so this is a deliberate no-op
// on Platform.OS === 'web' rather than a gap to fill in later.
export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    async function register() {
      if (!Device.isDevice) return; // simulators have no push capability
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted' || cancelled) return;

      // Throws in Expo Go (remote push was removed there in SDK 53) and in
      // any build without an EAS projectId configured yet — neither is a
      // real error for the user, just "push isn't available in this
      // environment," so degrade to a no-op instead of an uncaught rejection.
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

    // Tapping a delivered notification (app backgrounded or closed) — jump
    // straight to the relevant chat instead of leaving the user on whatever
    // screen they'd left the app on.
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
