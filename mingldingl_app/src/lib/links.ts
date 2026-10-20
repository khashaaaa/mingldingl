import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';

/** Where "Write to the keepers" goes. Unset → the button is not shown rather than mailing nowhere. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || null;

/** The App Store, not Google Play: the store's name, products and subscription page follow it. */
export const onApple = Platform.OS === 'ios';

const ANDROID_ID = Constants.expoConfig?.android?.package ?? 'com.mingldingl.app';
/** The App Store listing needs the numeric id Apple assigns at first submission. */
const IOS_STORE_URL = process.env.EXPO_PUBLIC_APP_STORE_URL || null;

/** This app's store page, or null where it has none yet (iOS before its first submission). */
export function storeUrl(): string | null {
  if (Platform.OS === 'android') return `market://details?id=${ANDROID_ID}`;
  if (Platform.OS === 'ios') return IOS_STORE_URL;
  return null;
}

/** The Play Store app may be missing (some Android builds); the web listing always opens. */
export async function openStore() {
  const url = storeUrl();
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS === 'android')
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${ANDROID_ID}`).catch(() => {});
  }
}

/** The store's page for this app's subscription, where a store floor is cancelled or changed. */
export function manageStore() {
  const url = onApple
    ? 'https://apps.apple.com/account/subscriptions'
    : `https://play.google.com/store/account/subscriptions?package=${ANDROID_ID}`;
  Linking.openURL(url).catch(() => {});
}

/** Where the privacy, terms and deletion pages live (the keepers' web host). Unset → no links to them. */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') || null;
export const hasLegalPages = WEB_URL !== null;

export function openLegal(page: 'privacy' | 'terms') {
  if (WEB_URL) Linking.openURL(`${WEB_URL}/${page}/`).catch(() => {});
}

export function writeToKeepers() {
  if (SUPPORT_EMAIL) Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
}

const ALLY_KEY = 'mingl.allyCall';

/**
 * Links the app is opened by: `mingldingl://ally/<code>` (an ally's call — kept on the phone until
 * the sign-up that follows carries it) and `mingldingl://thread/<code>` (an invitation — it opens
 * the Quest Log, where the thread waits under your number). Anything else routes as it is.
 */
export function redirectLink(path: string): string {
  const ally = /^\/?ally\/([A-Za-z]{4}-\d{4})\/?$/.exec(path);
  if (ally?.[1]) {
    SecureStore.setItemAsync(ALLY_KEY, ally[1].toUpperCase()).catch(() => {});
    return '/';
  }
  if (/^\/?thread\/[A-Za-z]{6}\/?$/.test(path)) return '/quests';
  return path;
}

/** The ally call this phone was opened with, if any; cleared once a sign-up has carried it. */
export const allyCall = () => SecureStore.getItemAsync(ALLY_KEY).catch(() => null);
export const forgetAllyCall = () => SecureStore.deleteItemAsync(ALLY_KEY).catch(() => {});

/** "mingldingl://ally/MNKH-4821": what a shared call opens. */
export const allyLink = (code: string) => `mingldingl://ally/${code}`;
export const threadLink = (code: string) => `mingldingl://thread/${code}`;
