import type { Href } from 'expo-router';

/**
 * Links that arrive while the app is already open — a notification, a shared link, another app.
 *
 * expo-router turns each one into a push, so the same screen opened twice by link stacked twice:
 * settings → satchel → settings → satchel was four screens deep, and the back button walked
 * through every copy (2026-10-04). In-app links already go through `goTo`, which returns to a
 * screen that is open instead; this sends the incoming ones the same way. The router's own
 * `dangerouslySingular` was not used: it moves the old copy to the top rather than going back to
 * it, which its source marks as able to freeze react-native-screens.
 */
let handler: ((href: Href) => void) | null = null;

/** The tab screens, which a link names without their group (`/profile`). `goTo` recognises a tab
 *  by the `/(tabs)` prefix, so without it a tab link searched the stack for a screen called
 *  "profile", found none above the tabs, and did nothing. Kept in step with `app/(tabs)` by test. */
export const TAB_ROUTES = ['discover', 'matches', 'townsquare', 'activity', 'profile'] as const;

/** Set by the root layout once its router and stack are live; cleared when it unmounts. */
export function setIncomingLinkHandler(next: ((href: Href) => void) | null): void {
  handler = next;
}

/** `mingldingl://settings?x=1` → `/settings?x=1`. Null for a link that is not an app route — the
 *  dev client's own `expo-development-client` links, and anything without this app's scheme. */
export function incomingPath(url: string, scheme: string): string | null {
  const prefix = `${scheme}://`;
  if (!url.toLowerCase().startsWith(prefix)) return null;
  const rest = url.slice(prefix.length).replace(/^\/+/, '');
  if (rest.startsWith('expo-development-client')) return null;
  const first = rest.split(/[/?#]/)[0];
  if ((TAB_ROUTES as readonly string[]).includes(first)) return `/(tabs)/${rest}`;
  return `/${rest}`;
}

/**
 * The `+native-intent` hook. A cold-start link is left to the router — nothing is mounted to
 * return to — and so is anything that is not an app route. A warm one is handled here and
 * swallowed (`null`), so the router does not push it a second time.
 */
export function routeIncomingLink(path: string, initial: boolean, scheme: string): string | null {
  if (initial || !handler) return path;
  const href = incomingPath(path, scheme);
  if (href === null) return path;
  handler(href as Href);
  return null;
}
