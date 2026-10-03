import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { router, Stack, Tabs } from 'expo-router';
import { store } from 'expo-router/build/global-state/router-store';
import { backToChat, goBack, goHome, goTo, stackHas } from '../navigation';

// The real expo-router and React Navigation stack, not the mock: what these guard against lives in
// how the routers treat an action — POP_TO matching by route name, REPLACE minting a fresh route —
// which no mock of `router` can show.
jest.unmock('expo-router');

const screen = (name: string) => () => <Text>{name}</Text>;
const app = () => ({
  _layout: () => <Stack />,
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/discover': screen('discover'),
  '(tabs)/matches': screen('matches'),
  '(tabs)/townsquare': screen('townsquare'),
  '(tabs)/profile': screen('profile'),
  'chat/[matchId]': screen('chat'),
  'quiz/[matchId]': screen('quiz'),
  'icebreaker/[matchId]': screen('icebreaker'),
  'campaign/[matchId]': screen('campaign'),
  'activities/[matchId]': screen('activities'),
  'business/[id]': screen('business'),
  'townsquare-round/[sessionId]': screen('round'),
  hearth: screen('hearth'),
  progression: screen('progression'),
  leaderboard: screen('leaderboard'),
  satchel: screen('satchel'),
  settings: screen('settings'),
});

type Route = { name: string; params?: { matchId?: string }; state?: unknown };
const rootStack = () => {
  const s = store.state as unknown as { routes: Route[] };
  return (s.routes[0].state ?? s) as { index: number; routes: Route[] };
};
const opened = () => rootStack().routes.map((r) => (r.params?.matchId ? `${r.name}:${r.params.matchId}` : r.name));
const identity = (r: Route & { params?: Record<string, unknown> }) => r.name === '(tabs)' ? r.name
  : `${r.name}${JSON.stringify(Object.fromEntries(Object.entries(r.params ?? {}).filter(([k]) => !k.startsWith('__'))))}`;
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

// Every route through these helpers, in any order: a lap of random taps — links, Back, the way home,
// "back to chat" — must never leave one screen in the stack twice, nor more than one tab bar.
// Against the helpers as they stood before this test, a lap failed within fifty taps.
const links = [
  '/(tabs)/discover', '/(tabs)/matches', '/(tabs)/townsquare', '/(tabs)/profile',
  ...['m1', 'm2', 'm3'].flatMap((m) => ['chat', 'quiz', 'icebreaker', 'campaign', 'activities'].map((s) => `/${s}/${m}`)),
  '/business/b1', '/business/b2', '/townsquare-round/s1',
  '/hearth', '/progression', '/leaderboard', '/satchel', '/settings',
];

it.each([1, 2, 3, 4, 5, 6, 7, 8])('lap %i of random taps never stacks a screen twice', (lap) => {
  let seed = lap * 7919;
  const pick = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
  for (let tap = 0; tap < 200; tap++) {
    const roll = pick(10);
    act(() => {
      if (roll < 7) goTo(router, links[pick(links.length)] as never, store.state as never);
      else if (roll === 7) goBack(router);
      else if (roll === 8) goHome(router, stackHas(store.state as never, 'hearth'));
      else {
        const s = rootStack();
        const top = s.routes[s.index ?? s.routes.length - 1];
        const matchId = top.params?.matchId;
        if (matchId && /^(quiz|icebreaker|activities)\//.test(top.name)) backToChat(router, s as never, matchId);
      }
    });
    const ids = rootStack().routes.map(identity);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(ids[0]).toBe('(tabs)');
    expect(ids.filter((id) => id === '(tabs)')).toHaveLength(1);
  }
});
