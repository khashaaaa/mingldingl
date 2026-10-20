import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';
import { devStorePurchase, syncStoreMembership } from './api/generated/engine';
import { onApple } from './links';
import { onSignedOut } from './session';

/**
 * The store (Google Play or the App Store, through RevenueCat). The engine never takes the app's word: after a
 * purchase the app asks it to look (`/me/membership/sync`), and the engine asks RevenueCat.
 *
 * Play Console: subscriptions `hall` and `high_table`, each with base plans `m1`, `m3`, `m6`.
 * App Store Connect: one subscription group, products `hall_m1` … `high_table_m6` (Apple ids have
 * no base plans). RevenueCat entitlements `hall` and `high_table` hold both stores' products. Without a key (development) a pretend purchase
 * goes through the engine's dev route instead, so the flow can be walked on a phone.
 */
const KEY = onApple
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  : Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
    : undefined;

export type PaidFloor = 'hall' | 'highTable';
export type Months = 1 | 3 | 6;

export const productId = (floor: PaidFloor, months: Months) =>
  `${floor === 'highTable' ? 'high_table' : 'hall'}${onApple ? '_' : ':'}m${months}`;

let configured = false;
let configuredFor: string | null = null;

/** Once per signed-in account; RevenueCat's user is the account id, so the engine can find it. */
export async function storeSignIn(accountId: string) {
  if (!KEY || configuredFor === accountId) return;
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: accountId });
    configured = true;
  } else await Purchases.logIn(accountId);
  configuredFor = accountId;
}

async function storeSignOut() {
  if (!KEY || configuredFor === null) return;
  configuredFor = null;
  await Purchases.logOut().catch(() => {});
}
onSignedOut(() => void storeSignOut());

/** Whether buying can happen on this build: a store key, or a development build. */
export const storeOpen = () => Boolean(KEY) || __DEV__;

/** The store's own price strings ("₮10,900.00"), keyed by product id; empty when unknown. */
export async function storePrices(): Promise<Record<string, string>> {
  if (!KEY || !configuredFor) return {};
  const ids = (['hall', 'highTable'] as const).flatMap((f) =>
    ([1, 3, 6] as const).map((m) => productId(f, m)),
  );
  const products = await Purchases.getProducts(ids, PRODUCT_CATEGORY.SUBSCRIPTION).catch(() => []);
  return Object.fromEntries(products.map((p: PurchasesStoreProduct) => [p.identifier, p.priceString]));
}

/** 'bought' once the store took it and the engine has looked; 'cancelled' when the sheet was closed. */
export async function buy(floor: PaidFloor, months: Months): Promise<'bought' | 'cancelled'> {
  if (!KEY) {
    if (!__DEV__) throw new Error('store.closed');
    await devStorePurchase({ floor, months });
    return 'bought';
  }
  const [product] = await Purchases.getProducts([productId(floor, months)], PRODUCT_CATEGORY.SUBSCRIPTION);
  if (!product) throw new Error('store.missing');
  try {
    await Purchases.purchaseStoreProduct(product);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
  // RevenueCat's webhook will say the same; asking now makes the floor open at once.
  await syncStoreMembership().catch(() => {});
  return 'bought';
}
