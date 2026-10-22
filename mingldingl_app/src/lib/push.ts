import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { clearPushToken, setPushToken } from './api/generated/engine';
import { onSignedOut, session } from './session';

const ASKED_KEY = 'mingl.pushAsked';
const OFF_KEY = 'mingl.pushOff';
/** The account and token last handed to the engine for this sign-in: the same pair is not sent again. */
const SENT_KEY = 'mingl.pushSent';

// A new sign-in is a new device session at the engine, which holds no token yet.
onSignedOut(() => {
  SecureStore.deleteItemAsync(SENT_KEY).catch(() => {});
});

// With the app open, a live event already shows its nudge: the system banner would be a second bell.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** "May we ring for you?" is asked once per device, after the first bond is made. */
export async function shouldAskToRing() {
  if ((await SecureStore.getItemAsync(ASKED_KEY)) === 'yes') return false;
  return (await Notifications.getPermissionsAsync()).status !== 'granted';
}

/** The person's answer on the ring screen; yes raises the system ask. */
export async function answerRing(yes: boolean) {
  await SecureStore.setItemAsync(ASKED_KEY, 'yes');
  if (!yes) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') await registerPushToken();
}

/**
 * Hands this device's push token to the engine (it is kept per device session, so every sign-in
 * registers again). Only once permission is granted; a failure here — no push service on the device,
 * no network — only means no pushes, never an error on screen.
 */
export async function registerPushToken() {
  try {
    if ((await SecureStore.getItemAsync(OFF_KEY)) === 'yes') return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Letters and bells',
        importance: Notifications.AndroidImportance.HIGH,
      });
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const sent = `${session.get()?.accountId ?? ''}|${data}`;
    if ((await SecureStore.getItemAsync(SENT_KEY)) === sent) return;
    await setPushToken({ token: data });
    await SecureStore.setItemAsync(SENT_KEY, sent);
  } catch (e) {
    if (__DEV__) console.warn('push token not registered', e);
  }
}

/** War Room → Notifications: on while this device is allowed to ring and has not switched it off. */
export async function pushIsOn() {
  if ((await SecureStore.getItemAsync(OFF_KEY)) === 'yes') return false;
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

/**
 * Switching on asks the system when it has not been asked (or sends the person to the app's
 * settings when it was refused); switching off drops this device's token at the engine.
 */
export async function setPushOn(on: boolean): Promise<boolean> {
  if (!on) {
    await SecureStore.setItemAsync(OFF_KEY, 'yes');
    await SecureStore.deleteItemAsync(SENT_KEY);
    await clearPushToken().catch(() => {});
    return false;
  }
  await SecureStore.deleteItemAsync(OFF_KEY);
  await SecureStore.setItemAsync(ASKED_KEY, 'yes');
  const perm = await Notifications.getPermissionsAsync();
  const status =
    perm.status === 'granted'
      ? perm.status
      : perm.canAskAgain
        ? (await Notifications.requestPermissionsAsync()).status
        : perm.status;
  if (status !== 'granted') {
    await Linking.openSettings().catch(() => {});
    return false;
  }
  await registerPushToken();
  return true;
}
