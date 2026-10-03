import { useCallback } from 'react';
import * as ExpoRouter from 'expo-router';
import type { Href } from 'expo-router';
import { goTo } from '../lib/navigation';

/** Absent from the many test mocks of expo-router, where `goTo` then falls back to a plain push. */
const useContainerRef = ExpoRouter.useNavigationContainerRef ?? (() => undefined);

/**
 * `goTo` bound to this app's router and the live stack, read at press time rather than subscribed
 * to — `useRootNavigationState` would re-render every caller on every navigation. Use it for every
 * in-app link; a bare `router.push` stacks a second copy of a screen that is already open.
 */
export function useGoTo(): (href: Href) => void {
  const router = ExpoRouter.useRouter();
  const nav = useContainerRef();
  return useCallback(
    (href: Href) => goTo(router, href, nav?.isReady?.() ? nav.getRootState() : undefined),
    [router, nav],
  );
}
