/**
 * The one `expo-router` mock. Every test used to write its own, each carrying only the router
 * methods its screen happened to call that day, so a component that started calling one more
 * (`canGoBack`, `dismissTo`) broke twenty unrelated suites. A file passes only what it asserts on;
 * everything else is a working default here.
 *
 *   jest.mock('expo-router', () => require('…/lib/testing/expoRouterMock').expoRouterMock({
 *     useRouter: () => ({ push: mockPush }),
 *   }));
 *
 * `useRouter`'s override is merged over a full default router rather than replacing it.
 */
type Hooks = Record<string, unknown> & { useRouter?: () => Record<string, unknown> };

export function expoRouterMock(overrides: Hooks = {}) {
  const defaults = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    setParams: jest.fn(),
    canGoBack: () => true,
    canDismiss: () => true,
  };
  const { useRouter: routerOverride, ...hooks } = overrides;
  return {
    useRouter: () => ({ ...defaults, ...(routerOverride ? routerOverride() : {}) }),
    usePathname: () => '/test',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    useSegments: () => [],
    useRootNavigationState: () => ({ routes: [] }),
    useNavigation: () => ({ getState: () => ({ index: 0, routes: [] }), addListener: () => () => {} }),
    useFocusEffect: () => {},
    Link: ({ children }: { children?: unknown }) => children,
    ...hooks,
  };
}
