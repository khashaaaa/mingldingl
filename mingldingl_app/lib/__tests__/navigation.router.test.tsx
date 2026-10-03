import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { router, Stack, Tabs } from 'expo-router';
import { store } from 'expo-router/build/global-state/router-store';
import { backToChat, goTo } from '../navigation';

// The real expo-router and React Navigation stack, not the mock: what these guard against lives in
// how the routers treat an action — POP_TO matching by route name, REPLACE minting a fresh route —
// which no mock of `router` can show.
jest.unmock('expo-router');

const screen = (name: string) => () => <Text>{name}</Text>;
const app = () => ({
  _layout: () => <Stack />,
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/discover': screen('discover'),
  '(tabs)/townsquare': screen('townsquare'),
  'chat/[matchId]': screen('chat'),
  'quiz/[matchId]': screen('quiz'),
  'townsquare-round/[sessionId]': screen('round'),
  progression: screen('progression'),
});

type Route = { name: string; params?: { matchId?: string }; state?: unknown };
const rootStack = () => {
  const s = store.state as unknown as { routes: Route[] };
  return (s.routes[0].state ?? s) as { index: number; routes: Route[] };
};
const opened = () => rootStack().routes.map((r) => (r.params?.matchId ? `${r.name}:${r.params.matchId}` : r.name));
const visit = (...paths: string[]) => paths.forEach((p) => act(() => router.push(p as never)));

beforeEach(() => renderRouter(app(), { initialUrl: '/discover' }));

it('returns to the very chat named, past another chat on the same screen', () => {
  visit('/chat/m1', '/chat/m2');
  act(() => goTo(router, '/chat/m1', store.state as never));
  expect(opened()).toEqual(['(tabs)', 'chat/[matchId]:m1']);
});

it('leaves a round for the tabs already underneath, not a second tab bar', () => {
  visit('/townsquare-round/s1');
  act(() => goTo(router, '/(tabs)/townsquare'));
  expect(opened()).toEqual(['(tabs)']);
});

it('goes back to a chat already open further down rather than opening another', () => {
  visit('/chat/m1', '/progression', '/quiz/m1');
  act(() => backToChat(router, rootStack() as never, 'm1'));
  expect(opened()).toEqual(['(tabs)', 'chat/[matchId]:m1']);
});
