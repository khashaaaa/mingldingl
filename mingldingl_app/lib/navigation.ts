import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** A route inside the tab bar. The tabs are one navigator that is always at the bottom of the stack. */
export function isTabRoute(href: Href): boolean {
  const path = typeof href === 'string' ? href : href.pathname;
  return path.startsWith('/(tabs)');
}

/**
 * Where every "go to that room" link goes through. `router.push` to a tab route from a screen
 * stacked above the tabs pushes a *second* copy of the whole tab navigator, so hearth → room →
 * hearth → room grew the stack by two full tab bars a lap and the back button walked through
 * every one. A tab route pops back to the tabs that are already there and switches to the tab;
 * with nothing underneath (a cold deep link) the tabs replace the current screen instead.
 */
export function goTo(router: Router, href: Href, state?: NavState): void {
  if (isTabRoute(href)) { router.dismissTo(href); return; }
  // Any other screen already open is returned to, never stacked again. The atlas's Hall pushed a
  // second progression over progression → leaderboard, and again over itself on every tap, so the
  // back button walked through copies; a notification for the chat you were in stacked that chat
  // on itself. With no state to read (a test, a cold start) it falls back to a plain push.
  // Popped by count, not `dismissTo`: POP_TO matches by route *name*, so with chat m1 under chat m2
  // it stopped at m2 and relabelled it m1 — two copies of the one chat.
  const above = screensAbove(state, hrefPath(href));
  if (above === null) router.push(href);
  else if (above > 0) router.dismiss(above);
}

/** The concrete path an href points at: `/chat/m1` for both `'/chat/m1'` and
 *  `{ pathname: '/chat/[matchId]', params: { matchId: 'm1' } }`. Query strings are dropped. */
export function hrefPath(href: Href): string {
  if (typeof href === 'string') return href.split('?')[0];
  const params = (href.params ?? {}) as Record<string, unknown>;
  return href.pathname.replace(/\[(\.\.\.)?(\w+)\]/g, (_, _rest, key) => String(params[key] ?? ''));
}

/** The path a stack entry stands for: `chat/[matchId]` + `{ matchId: 'm1' }` → `/chat/m1`. Groups
 *  (`(tabs)`) and `index` segments are not part of the URL. */
function routePath(name: string, params: Record<string, unknown> | undefined): string {
  const segments = name.split('/')
    .filter((seg) => !/^\(.*\)$/.test(seg) && seg !== 'index')
    .map((seg) => seg.replace(/^\[(\.\.\.)?(\w+)\]$/, (_, _rest, key) => String(params?.[key] ?? '')));
  return `/${segments.join('/')}`;
}

/** How many screens sit above `path` in the stack that holds it — 0 when it is on top — or null
 *  when it is not open. */
function screensAbove(state: NavState | undefined, path: string): number | null {
  if (!state?.routes) return null;
  const at = state.routes.findLastIndex((r) => r.name !== '__root' && routePath(r.name, r.params as Record<string, unknown> | undefined) === path);
  if (at >= 0) return (state.index ?? state.routes.length - 1) - at;
  for (const r of state.routes) {
    const found = screensAbove(r.state, path);
    if (found !== null) return found;
  }
  return null;
}

/** The way home. Back to the hearth already in the stack, or a fresh one when there is none. */
export function goHome(router: Router, hearthOpen: boolean): void {
  if (hearthOpen) router.dismissTo('/hearth');
  else router.push('/hearth');
}

export interface NavState {
  index?: number;
  routes?: readonly { name: string; params?: object; state?: NavState }[];
}

/** Whether a route of this name is open anywhere in the tree. expo-router wraps the whole app in a
 *  `__root` route, so the stack a screen sits in is never the top level of the root state. */
export function stackHas(state: NavState | undefined, name: string): boolean {
  return (state?.routes ?? []).some((r) => r.name === name || stackHas(r.state, name));
}

/**
 * Back, or — with nothing beneath (a cold deep link) — to the tabs. A bare `router.back()` there
 * does nothing, and every screen reached that way offered a back arrow that did not work.
 */
export function goBack(router: Router): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/discover');
}

/** The screens a match's side-pages are opened from; "back to chat" may simply go back to these. */
const CHAT_PARENTS = ['chat/[matchId]', 'campaign/[matchId]'];

/**
 * "Back to chat" that actually lands on the chat. A notification opens the Rite or the pledged
 * encounter straight over the tabs, so going back from there dropped you on whichever tab you had
 * last, under a button that promised the thread. `stack` is the stack this page sits in: a chat
 * already open further down is returned to rather than replaced in again on top of itself.
 */
export function backToChat(router: Router, stack: NavState | undefined, matchId: string): void {
  const routes = stack?.routes ?? [];
  const index = stack?.index ?? routes.length - 1;
  const previous = index > 0 ? routes[index - 1]?.name : undefined;
  if (previous && CHAT_PARENTS.includes(previous)) { router.back(); return; }
  const above = screensAbove(stack, `/chat/${matchId}`);
  if (above) router.dismiss(above);
  else router.replace(`/chat/${matchId}`);
}
