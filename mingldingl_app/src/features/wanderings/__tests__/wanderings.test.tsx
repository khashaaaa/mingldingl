import { act, fireEvent, screen } from 'expo-router/testing-library';
import WorldLayout from '@/app/(world)/_layout';
import type { WanderingsView, WanderingView } from '@/lib/api/generated/model';
import { applyLiveEvent } from '@/lib/live/events';
import { ME, settle, showWorld } from '@/lib/testing/world';
import WanderingScreen from '../WanderingScreen';
import WanderingsScreen from '../WanderingsScreen';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };

const row = (key: string, road: string, state: string, season = 'any') => ({
  key,
  title: key === 'songs-of-steppe' ? 'Songs of the Steppe' : key,
  line: `${key} line`,
  road,
  season,
  state,
});

const detail = (over: Partial<WanderingView> = {}): WanderingView => ({
  key: 'songs-of-steppe',
  title: 'Songs of the Steppe',
  line: 'Morin khuur and khöömii, live',
  body: 'Hear the morin khuur or throat singing live.',
  where: 'Tumen Ekh, Tsagaan Lavai or Ganzam Palace.',
  road: 'first',
  season: 'juneSept',
  state: 'open',
  venues: [],
  myLine: null,
  theirLineWritten: false,
  theirLine: null,
  fellow: 0,
  ...over,
});

type World = { list: WanderingsView; one: WanderingView; posts: string[] };

function fakeEngine(): World {
  const w: World = {
    list: {
      keptMeetings: 1,
      firstOpen: true,
      trustedOpen: false,
      taken: 0,
      fellow: 0,
      items: [
        row('songs-of-steppe', 'first', 'open', 'juneSept'),
        row('dawn-hill', 'trusted', 'sealed', 'warm'),
      ],
    },
    one: detail(),
    posts: [],
  };
  apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
    const key = `${init.method} ${url.split('?')[0]}`;
    if (init.method === 'POST') w.posts.push(url);
    switch (key) {
      case 'GET /me':
        return ME;
      case 'POST /me/dawn':
        return { earned: 0, streak: 1, seventh: false };
      case 'GET /bonds/b1':
        return { other: { name: 'Saruul' } };
      case 'GET /bonds/b1/wanderings':
        return w.list;
      case 'GET /bonds/b1/wanderings/songs-of-steppe':
        return w.one;
      case 'POST /bonds/b1/wanderings/songs-of-steppe/ask':
        w.one = detail({ state: 'asked' });
        return w.one;
      case 'POST /bonds/b1/wanderings/songs-of-steppe/yes':
        w.one = detail({ state: 'going' });
        return w.one;
      case 'POST /bonds/b1/wanderings/songs-of-steppe/line':
        w.one = detail({ state: 'going', myLine: JSON.parse(String(init.body)).text });
        return w.one;
      default:
        throw new Error(`unrouted ${key}`);
    }
  });
  return w;
}

const ROUTES = {
  '(world)/_layout': WorldLayout,
  '(world)/wanderings/[id]/index': WanderingsScreen,
  '(world)/wanderings/[id]/[key]': WanderingScreen,
  '(world)/meeting/[id]': () => null,
  '(world)/(tabs)/seek': () => null,
};

const show = (url: string) => showWorld(ROUTES, url, { settles: 3 });

let w: World;
beforeEach(() => {
  jest.clearAllMocks();
  w = fakeEngine();
});

describe('Wanderings', () => {
  test('the roads list both roads, with the season hint and the sealed trusted road', async () => {
    await show('/wanderings/b1');
    expect(screen.getByText('FIRST ROADS')).toBeTruthy();
    expect(screen.getByText('Songs of the Steppe')).toBeTruthy();
    expect(screen.getByText('BEST JUNE–SEPT')).toBeTruthy();
    expect(screen.getByText('SEALED')).toBeTruthy();
  });

  test('an open Wandering shows where, and asking waits on their answer', async () => {
    await show('/wanderings/b1/songs-of-steppe');
    expect(screen.getByText('Tumen Ekh, Tsagaan Lavai or Ganzam Palace.')).toBeTruthy();
    expect(screen.getByText(/No points, nothing lost/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ask Saruul to wander' }));
    await settle();
    expect(w.posts).toContain('/bonds/b1/wanderings/songs-of-steppe/ask');
    expect(screen.getByText('You asked. Waiting for Saruul to answer.')).toBeTruthy();
  });

  test('swearing it as a meeting opens the meeting for the bond', async () => {
    const { view } = await show('/wanderings/b1/songs-of-steppe');
    await fireEvent.press(screen.getByRole('link', { name: 'Swear it as a meeting' }));
    await settle();
    expect(view.getPathname()).toBe('/meeting/b1');
  });

  test('asked of me: Let’s go, then my line is sealed until theirs comes, and a live event reveals both', async () => {
    w.one = detail({ state: 'askedOfMe' });
    const { client } = await show('/wanderings/b1/songs-of-steppe');
    expect(screen.getByText('Saruul asks you to wander: Songs of the Steppe.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Let's go" }));
    await settle();
    expect(screen.getByText('What will you remember?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Your line'), 'The old man on the fiddle.');
    await fireEvent.press(screen.getByRole('button', { name: 'Seal my line' }));
    await settle();
    expect(screen.getByText('Your line is sealed')).toBeTruthy();

    w.one = detail({
      state: 'kept',
      myLine: 'The old man on the fiddle.',
      theirLine: 'How quiet it went.',
      fellow: 1,
    });
    await act(() => applyLiveEvent(client, { kind: 'wandering.updated', ids: ['b1'] }, jest.fn()));
    await settle();
    expect(screen.getByText('How quiet it went.')).toBeTruthy();
    expect(screen.getByText('A Wandering kept. 1 of 3 toward Fellow Travellers.')).toBeTruthy();
  });
});
