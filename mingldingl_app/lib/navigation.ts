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
export function goTo(router: Router, href: Href): void {
  if (isTabRoute(href)) router.dismissTo(href);
  else router.push(href);
}

/** The way home. Back to the hearth already in the stack, or a fresh one when there is none. */
export function goHome(router: Router, hearthOpen: boolean): void {
  if (hearthOpen) router.dismissTo('/hearth');
  else router.push('/hearth');
}

interface NavState { routes?: readonly { name: string; state?: NavState }[] }

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
 * last, under a button that promised the thread.
 */
export function backToChat(router: Router, previousRoute: string | undefined, matchId: string): void {
  if (previousRoute && CHAT_PARENTS.includes(previousRoute)) router.back();
  else router.replace(`/chat/${matchId}`);
}
