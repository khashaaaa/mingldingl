import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../lib/theme';

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
 * The engine tags every push with a `type` (see `PushCopy.WireType` on the engine). Routing
 * every one of them to the chat sent a Flame Rite proposal — whose whole point is the video
 * screen — to the wrong place; unknown types still fall back to the chat, which is where a
 * match, a message, a pledged encounter, or a closed thread belongs.
 */
export function destinationFor(
  type: string | undefined,
  matchId: string,
): `/video/${string}` | `/chat/${string}` | `/activities/${string}` | '/(tabs)/townsquare' {
  switch (type) {
    case 'flame_rite_proposed':
    case 'flame_rite_accepted':
      return `/video/${matchId}`;
    case 'townsquare_started':
      return '/(tabs)/townsquare';
    // Its own copy is "Open the activity for the details", and the details are the pledged
    // encounter — the venue, the time, the confirmation — none of which is in the thread.
    case 'date_confirmed':
      return `/activities/${matchId}`;
    default:
      return `/chat/${matchId}`;
  }
}

/**
 * The Android channel every push names (`channelId` on the engine's Expo payload). Android takes a
 * notification's importance from its channel, not from the message, so without one created here
 * every push landed in Expo's fallback channel at default importance: no heads-up banner, no
 * sound, easy to miss entirely.
 */
const ANDROID_CHANNEL_ID = 'default';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'MingldIngl',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: COLORS.gold,
  });
}

export function usePushNotifications() {
  const router = useRouter();
  // Registration is an authenticated call, so it has to wait for a session and re-run when the
  // account changes. Running once on mount meant a cold start could register before the stored
  // session was restored (a swallowed 401, and no push for that whole run), and signing out —
  // which unregisters the token — then signing back in on the same launch left the next person
  // with no notifications at all until they force-quit the app.
  const userId = useAuthStore((s) => s.session?.user.id);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId) return;
    let cancelled = false;

    async function register() {
      if (!Device.isDevice) return;
      await ensureAndroidChannel();
      if (cancelled) return;

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

    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const type = data?.type as string | undefined;
      const matchId = data?.matchId as string | undefined;
      if (!matchId && type !== 'townsquare_started') return;
      router.push(destinationFor(type, matchId ?? ''));
    });

    return () => { sub.remove(); };
  }, [router]);
}
