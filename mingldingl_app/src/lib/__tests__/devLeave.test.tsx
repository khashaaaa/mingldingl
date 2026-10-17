import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { leaveTools } from '../devTools';
import type { Belongs } from '../gate';

type Group = Belongs['group'];
let group: Group = 'world';
const subs = new Set<() => void>();
const setGroup = (g: Group) => {
  group = g;
  for (const f of subs) f();
};
const useGroup = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => group,
  );

/** The root layout's shape: one protected group at a time, the tools as a modal over it. */
function Root() {
  const g = useGroup();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={g === 'world'}>
        <Stack.Screen name="(world)" />
      </Stack.Protected>
      <Stack.Protected guard={g === 'onboarding'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Screen name="dev/index" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

async function openToolsIn(start: Group) {
  setGroup(start);
  const view = renderRouter(
    {
      _layout: Root,
      '(world)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(world)/(tabs)/_layout': () => <Tabs initialRouteName="character" />,
      '(world)/(tabs)/character': () => <Text>WORLD</Text>,
      '(onboarding)/index': () => <Text>ONBOARDING</Text>,
      'dev/index': () => <Text>TOOLS</Text>,
    },
    { initialUrl: start === 'world' ? '/character' : '/' },
  );
  await view;
  jest.useRealTimers();
  await act(async () => router.push('/dev'));
  expect(screen.getByText('TOOLS')).toBeTruthy();
  return view;
}

const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

test('leaving the tools goes back to the screen they opened over', async () => {
  await openToolsIn('world');
  await act(async () => leaveTools('world'));
  await tick();
  expect(screen.queryByText('TOOLS')).toBeNull();
  expect(screen.getByText('WORLD')).toBeTruthy();
});

test.each([
  ['world', 'onboarding', 'ONBOARDING'],
  ['onboarding', 'world', 'WORLD'],
] as const)('a seed state that moves %s → %s leaves into the new group', async (from, to, shows) => {
  await openToolsIn(from);
  await act(async () => setGroup(to));
  expect(router.canGoBack()).toBe(false);
  await act(async () => leaveTools(to));
  await tick();
  expect(screen.queryByText('TOOLS')).toBeNull();
  expect(screen.getByText(shows)).toBeTruthy();
});
