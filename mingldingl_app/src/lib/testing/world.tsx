// Test-only: the world as the screen tests open it. Nothing in the app imports this.
import { notifyManager, QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { act, renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { getGetMeQueryKey, getMe } from '@/lib/api/generated/engine';
import type { MeView } from '@/lib/api/generated/model';

// renderRouter starts on fake timers and the harness drops them after the first render; a query
// that lands later would tell its screen on a fake setTimeout that never fires.
notifyManager.setScheduler((cb) => {
  Promise.resolve().then(cb);
});

/** A finished Opal account, as most world tests start. */
export const ME: MeView = {
  accountId: 'me',
  status: 'Active',
  phoneHint: '9911',
  deleteAt: null,
  onboardingStep: 7,
  profile: {
    name: 'Bat',
    birthDate: '1995-03-14',
    age: 31,
    gender: 'Male',
    bio: 'falcon',
    city: 'Bayangol',
    oath: 'Bond',
    oathSwornAt: null,
    oathProvenAt: null,
    locale: 'en',
    points: 100,
    tier: 'Opal',
    tierUpPending: null,
    paused: false,
    awayUntil: null,
    awayNextAt: null,
    faceProvenAt: null,
    createdAt: '2026-10-06T00:00:00Z',
  },
};

// One macrotask: TanStack Query tells observers about new data on a setTimeout(0).
export const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

type Prefetch = { queryKey: QueryKey; queryFn: () => Promise<unknown> };

/**
 * Renders `routes` at `url` over a fresh query cache holding /me (the gate opens the world only
 * once it is there) plus `prefetch`, then lets `settles` rounds of chained fetches land.
 */
export async function showWorld(
  routes: Parameters<typeof renderRouter>[0],
  url: string,
  { prefetch = [], settles = 1 }: { prefetch?: Prefetch[]; settles?: number } = {},
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
      mutations: { retry: false },
    },
  });
  // Data that arrives after the first render waits on renderRouter's fake timers: have it first.
  for (const q of [{ queryKey: getGetMeQueryKey(), queryFn: () => getMe() }, ...prefetch])
    await client.prefetchQuery(q);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderRouter(routes, { initialUrl: url, wrapper });
  // renderRouter predates RNTL 14's async render: it hands back the pending render with its getters
  // attached, and turns on fake timers that nothing here needs.
  await view;
  jest.useRealTimers();
  for (let i = 0; i < settles; i++) await settle();
  return { client, view };
}
