import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import WorldLayout from '@/app/(world)/_layout';
import { getAppStatus, getGetAppStatusQueryKey, getGetMeQueryKey, getMe } from '@/lib/api/generated/engine';
import type { CityView, MeView, PhotoView, ProfileView } from '@/lib/api/generated/model';
import { setLocale } from '@/lib/i18n';
import { applyLiveEvent } from '@/lib/live/events';
import QuestLog from '../../bonds/QuestLog';
import Missions from '../../road/Missions';
import SeekScreen from '../../seek/SeekScreen';
import WarRoom from '../../settings/WarRoom';
import SquareTab from '../../square/SquareTab';
import WorldTabs from '../../world/WorldTabs';
import CharacterScreen from '../CharacterScreen';
import EditCharacter from '../EditCharacter';

jest.mock('@/lib/feedback', () => ({
  feedback: jest.fn(),
  deviceFeel: () => ({ sound: false, haptics: true }),
  saveSoundSetting: jest.fn(),
  saveHapticsSetting: jest.fn(),
}));
jest.mock('@/lib/push', () => ({
  ...jest.requireActual('@/lib/push'),
  pushIsOn: async () => false,
  setPushOn: jest.fn(async () => false),
}));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// expo-router's test mocks swap in Reanimated's bare mock, which lacks the hook jest.setup.js adds.
Object.assign(require('react-native-reanimated'), { useReducedMotion: () => false });

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };

const CITIES: CityView[] = [
  { name: 'Ulaanbaatar', kind: 'capital', region: 'Ulaanbaatar', lat: 47.9184, lng: 106.9177 },
  { name: 'Bayangol', kind: 'district', region: 'Ulaanbaatar', lat: 47.8975, lng: 106.8794 },
  { name: 'Erdenet', kind: 'province', region: 'Orkhon', lat: 49.0333, lng: 104.0833 },
];

const LADDER = [
  { name: 'Garnet', points: 0, candles: 5 },
  { name: 'Opal', points: 100, candles: 8 },
  { name: 'Amethyst', points: 300, candles: 13 },
  { name: 'Sapphire', points: 600, candles: 15 },
  { name: 'Ruby', points: 1000, candles: 16 },
  { name: 'Emerald', points: 2000, candles: 17 },
];

const photo = (id: string, position: number): PhotoView => ({
  id,
  url: `https://x/${id}`,
  expiresAt: '',
  thumbHash: '',
  width: 3,
  height: 4,
  position,
});

/** A finished account, and the routes Character and Edit call. */
function fakeEngine() {
  const e = {
    profile: {
      name: 'Мөнхболд',
      birthDate: '1995-03-14',
      age: 31,
      gender: 'Male',
      bio: 'I keep a falcon.',
      city: 'Bayangol',
      oath: 'Bond',
      oathSwornAt: '2026-10-06T00:00:00Z',
      locale: 'en',
      points: 0,
      tier: 'Garnet',
      tierUpPending: null,
      createdAt: '2026-10-06T00:00:00Z',
    } as ProfileView,
    photos: [photo('a', 0), photo('b', 1), photo('c', 2)],
    puts: [] as Record<string, unknown>[],
  };
  // Copies, like JSON off the wire: a shared object mutated in place would look unchanged to the cache.
  const me = (): MeView => ({
    accountId: 'acc',
    status: 'Active',
    phoneHint: '9911',
    deleteAt: null,
    profile: { ...e.profile },
    onboardingStep: 7,
  });
  apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    switch (`${init.method} ${url}`) {
      case 'GET /me':
        return me();
      case 'PUT /me':
        e.puts.push(body);
        for (const k of ['name', 'bio', 'city'] as const) if (body[k] !== null) e.profile[k] = body[k];
        return me();
      case 'GET /me/photos':
        return [...e.photos];
      case 'GET /geo/cities':
        return CITIES;
      case 'GET /app/status':
        return { minVersion: '1.0.0', maintenance: false, photosMin: 3, photosMax: 6 };
      case 'POST /me/dawn':
        return { earned: 0, streak: 1, seventh: false };
      case 'GET /tiers':
        return LADDER;
      case 'GET /bonds':
        return [];
      case 'GET /square':
        return { next: null };
      case 'GET /me/honours':
      case 'GET /me/chests':
        return [];
      case 'GET /me/encounter-log':
        return {
          standing: { kept: 0, counted: 0, openScars: 0, closedScars: 0, districts: [] },
          encounters: [],
        };
      case 'GET /me/quests':
        return {
          daily: [
            {
              kind: 'lightHearth',
              period: 'daily',
              progress: 1,
              target: 1,
              points: 20,
              done: true,
              claimed: false,
            },
          ],
          weekly: [],
          dawns: 1,
          lit: 1,
          streakCap: 7,
          gerRests: { left: 0, perMoon: 0, keptOn: null },
          day: '2026-10-10',
          weekEnds: '2026-10-11',
        };
      case 'GET /seek':
        return {
          state: 'empty',
          candidate: null,
          candlesLeft: 5,
          candlesPerDay: 5,
          nextDawnAt: '2026-10-08T16:00:00Z',
          seatsUsed: 0,
          seats: 4,
        };
      default:
        throw new Error(`unrouted ${init.method} ${url}`);
    }
  });
  return e;
}

const ROUTES = {
  '(world)/_layout': WorldLayout,
  '(world)/(tabs)/_layout': WorldTabs,
  '(world)/(tabs)/seek': SeekScreen,
  '(world)/(tabs)/quests': QuestLog,
  '(world)/(tabs)/missions': Missions,
  '(world)/(tabs)/square': SquareTab,
  '(world)/(tabs)/character': CharacterScreen,
  '(world)/character-edit': EditCharacter,
  '(world)/war-room': WarRoom,
};

async function show(url = '/character') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
      mutations: { retry: false },
    },
  });
  // The gate only opens the world once /me and /app/status are in the cache.
  await client.prefetchQuery({ queryKey: getGetMeQueryKey(), queryFn: () => getMe() });
  await client.prefetchQuery({ queryKey: getGetAppStatusQueryKey(), queryFn: () => getAppStatus() });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderRouter(ROUTES, { initialUrl: url, wrapper });
  // renderRouter predates RNTL 14's async render: it hands back the pending render with its getters
  // attached, and turns on fake timers that nothing here needs.
  await view;
  jest.useRealTimers();
  await settle();
  return { client, view };
}

// One macrotask: TanStack Query tells observers about new data on a setTimeout(0).
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));
const press = async (name: string | RegExp) => {
  await fireEvent.press(screen.getByRole('button', { name }));
  await settle();
};
/** Character's "⋮" opens the War Room; its first row is Edit. */
const openEdit = async () => {
  await press('The War Room');
  await press(/^Edit your character/);
};
const saveButton = () => screen.getByRole('button', { name: 'Save' });

let engine: ReturnType<typeof fakeEngine>;
beforeEach(() => {
  jest.clearAllMocks();
  engine = fakeEngine();
});

describe('Character', () => {
  test('shows the account, and a profile.updated event brings the new name', async () => {
    const { client } = await show();
    expect(screen.getByText('Мөнхболд, 31')).toBeTruthy();
    expect(screen.getByLabelText('Garnet')).toBeTruthy();
    expect(screen.getByLabelText('0 points')).toBeTruthy();
    expect(screen.getByText('Bond — sworn')).toBeTruthy();

    engine.profile.name = 'Болд';
    await act(() => applyLiveEvent(client, { kind: 'profile.updated', ids: ['acc'] }, jest.fn()));
    await settle();
    expect(screen.getByText('Болд, 31')).toBeTruthy();
  });

  test('a proven oath reads Proven once a score.changed event lands', async () => {
    const { client } = await show();
    engine.profile.oathProvenAt = '2026-10-10T12:00:00Z';
    await act(() => applyLiveEvent(client, { kind: 'score.changed', ids: ['acc'] }, jest.fn()));
    await settle();
    expect(screen.getByText('Bond — proven')).toBeTruthy();
  });

  test('Seek, the Quest Log, Missions and the Square open their rooms', async () => {
    await show();
    for (const [tab, room, line] of [
      ['Seek', 'The Tavern', 'The tavern is empty'],
      ['Quest Log', 'Quest Log', 'No bonds yet'],
      ['Missions', 'Missions', 'Light the hearth'],
      ['Square', 'Town Square', 'The square stands quiet'],
    ] as const) {
      await fireEvent.press(screen.getByRole('tab', { name: tab }));
      await settle();
      expect(screen.getByRole('header', { name: room })).toBeTruthy();
      expect(screen.getAllByText(line).length).toBeGreaterThan(0);
    }
  });

  test('a language switch redraws the tab bar too', async () => {
    await show();
    await act(async () => setLocale('pseudo'));
    expect(screen.queryByRole('tab', { name: 'Seek' })).toBeNull();
    await act(async () => setLocale('en'));
    expect(screen.getByRole('tab', { name: 'Seek' })).toBeTruthy();
  });

  test('switching tabs ten times leaves one screen per tab and nothing stacked', async () => {
    const { view } = await show();
    const order = ['Seek', 'Quest Log', 'Missions', 'Square', 'Character'];
    for (let i = 0; i < 10; i++) {
      await fireEvent.press(screen.getByRole('tab', { name: order[i % order.length] }));
      await settle();
    }
    const root = view.getRouterState()?.routes.find((r) => r.name === '__root')?.state;
    const world = root?.routes.find((r) => r.name === '(world)')?.state;
    expect(world?.routes.map((r) => r.name)).toEqual(['(tabs)']);
    const tabs = world?.routes[0]?.state as { routes: { name: string }[]; history?: unknown[] } | undefined;
    expect(tabs?.routes.map((r) => r.name).sort()).toEqual([
      'character',
      'missions',
      'quests',
      'seek',
      'square',
    ]);
    // Back from any tab goes to Character, not through every tab visited.
    expect(tabs?.history?.length).toBeLessThanOrEqual(2);
  });

  test('the header action opens the War Room, and its first row Edit', async () => {
    const { view } = await show();
    await press('The War Room');
    expect(view.getPathname()).toBe('/war-room');
    await press(/^Edit your character/);
    expect(view.getPathname()).toBe('/character-edit');
  });
});

describe('Edit your character', () => {
  test('Save is disabled until something changes, and again once it is changed back', async () => {
    await show('/character-edit');
    expect(saveButton().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Болд');
    await settle();
    expect(saveButton().props.accessibilityState?.disabled).toBe(false);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Мөнхболд');
    await settle();
    expect(saveButton().props.accessibilityState?.disabled).toBe(true);
  });

  test('the gender is shown and cannot be edited', async () => {
    await show('/character-edit');
    const gender = screen.getByLabelText('Gender');
    expect(gender.props.value).toBe('Man — cannot be changed');
    expect(gender.props.editable).toBe(false);
  });

  test('saving writes only what changed and returns to Character', async () => {
    const { view } = await show();
    await openEdit();
    await fireEvent.changeText(screen.getByLabelText('Your tale'), 'I read old maps.');
    await settle();
    await press('Save');
    expect(engine.puts).toHaveLength(1);
    expect(engine.puts[0]).toMatchObject({ name: null, bio: 'I read old maps.', city: null, gender: null });
    expect(view.getPathname()).toBe('/war-room');
  });

  test('back with unsaved changes asks first; Discard leaves without writing', async () => {
    const { view } = await show('/character');
    await openEdit();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Болд');
    await settle();

    await press('Back');
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    expect(view.getPathname()).toBe('/character-edit');

    await press('Discard');
    expect(view.getPathname()).toBe('/war-room');
    expect(engine.puts).toHaveLength(0);
  });

  test('back with nothing changed leaves at once', async () => {
    const { view } = await show('/character');
    await openEdit();
    await press('Back');
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    expect(view.getPathname()).toBe('/war-room');
  });
});
