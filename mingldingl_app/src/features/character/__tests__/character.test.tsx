import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import WorldLayout from '@/app/(world)/_layout';
import { ApiError } from '@/lib/api/client';
import {
  getAppStatus,
  getDeepProfile,
  getGetAppStatusQueryKey,
  getGetDeepProfileQueryKey,
} from '@/lib/api/generated/engine';
import type { CityView, MeView, PhotoView, ProfileView } from '@/lib/api/generated/model';
import { setLocale } from '@/lib/i18n';
import { applyLiveEvent } from '@/lib/live/events';
import { settle, showWorld } from '@/lib/testing/world';
import QuestLog from '../../bonds/QuestLog';
import Missions from '../../road/Missions';
import SeekScreen from '../../seek/SeekScreen';
import WarRoom from '../../settings/WarRoom';
import SquareTab from '../../square/SquareTab';
import WorldTabs from '../../world/WorldTabs';
import CharacterScreen from '../CharacterScreen';
import DeepProfile, { DeepPicker } from '../DeepProfile';
import EditCharacter from '../EditCharacter';
import FaceProof from '../FaceProof';

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
  CameraType: { front: 'front', back: 'back' },
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
/** The live front camera: ready at once, every picture the same tiny JPEG. */
const mockTakePicture = jest.fn(async (_options?: unknown) => ({ base64: 'AAAA', uri: 'file://s.jpg' }));
/** How many live previews are on screen: 0 means the camera light is off. */
const mockLens = { on: 0 };
jest.mock('expo-camera', () => {
  const { forwardRef, useEffect, useImperativeHandle } = jest.requireActual('react');
  return {
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
    CameraView: forwardRef((props: { onCameraReady?: () => void }, ref: unknown) => {
      useImperativeHandle(ref, () => ({ takePictureAsync: (o: unknown) => mockTakePicture(o) }));
      useEffect(() => {
        mockLens.on++;
        props.onCameraReady?.();
        return () => {
          mockLens.on--;
        };
      }, []);
      return null;
    }),
  };
});

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
    deep: {
      open: false,
      showChildren: false,
      answers: {
        hasChildren: null,
        wantsChildren: null,
        partnerChildren: null,
        smoking: null,
        drinking: null,
        faith: null,
        lifestyle: null,
      } as Record<string, string | null>,
    },
    deepPuts: [] as Record<string, unknown>[],
    face: { open: true, proven: false, turn: 'left', triesLeft: 3, triesPerDay: 3 },
    /** What the engine answers the next face check. */
    faceOutcome: 'proven',
    faceChecks: 0,
    /** A rule the engine answers the next face check with instead. */
    faceRefusal: null as ApiError | null,
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
      case 'GET /me/deep':
        return { ...e.deep, answers: { ...e.deep.answers } };
      case 'PUT /me/deep':
        e.deepPuts.push(body);
        for (const [k, v] of Object.entries(body))
          if (v !== null) {
            if (k === 'showChildren') e.deep.showChildren = v as boolean;
            else e.deep.answers[k] = v as string;
          }
        return { ...e.deep, answers: { ...e.deep.answers } };
      case 'GET /me/face':
        return { ...e.face };
      case 'POST /me/face':
        if (e.faceRefusal) throw e.faceRefusal;
        e.faceChecks++;
        e.face = { ...e.face, triesLeft: e.face.triesLeft - 1, proven: e.faceOutcome === 'proven' };
        if (e.face.proven) e.profile.faceProvenAt = '2026-10-22T00:00:00Z';
        return { outcome: e.faceOutcome, status: { ...e.face } };
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
          chests: 0,
          districtsCharted: 0,
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
  '(world)/face-proof': FaceProof,
  '(world)/war-room': WarRoom,
  '(world)/deep/index': DeepProfile,
  '(world)/deep/[field]': DeepPicker,
};

// The gate only opens the world once /app/status is in the cache too.
const STATUS = { queryKey: getGetAppStatusQueryKey(), queryFn: () => getAppStatus() };
const DEEP = { queryKey: getGetDeepProfileQueryKey(), queryFn: () => getDeepProfile() };
const show = (url = '/character') =>
  showWorld(ROUTES, url, { prefetch: url.startsWith('/deep') ? [STATUS, DEEP] : [STATUS] });

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

describe('Prove your face', () => {
  // A press waits for its handler, so it returns once the turn count has run out and the check is in.
  test('one tap on the live camera takes both selfies and proves it', async () => {
    const { view } = await show();
    await press(/^Your face/);
    expect(view.getPathname()).toBe('/face-proof');
    expect(screen.getByText(/turn your head to the left, so the camera sees your cheek/)).toBeTruthy();
    await press('Begin');
    // The straight selfie, then one at each tick of the turn count.
    expect(mockTakePicture).toHaveBeenCalledTimes(4);
    expect(mockTakePicture.mock.calls[0]?.[0]).toMatchObject({ shutterSound: false });
    expect(engine.faceChecks).toBe(1);
    expect(screen.getByText('Your face is proven')).toBeTruthy();
  });

  test('a miss says why and how many tries are left', async () => {
    engine.faceOutcome = 'notYou';
    await show('/face-proof');
    await press('Begin');
    expect(screen.getByText(/do not match your portraits/)).toBeTruthy();
    expect(screen.getByText('2 tries left today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  test('a picture that fails leaves the first step as it was', async () => {
    mockTakePicture.mockRejectedValueOnce(new Error('camera busy'));
    await show('/face-proof');
    await press('Begin');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(engine.faceChecks).toBe(0);
  });

  test('a rule the engine answers with is said in its own words', async () => {
    engine.faceRefusal = new ApiError('rule', 409, 'face.tries', 'none left');
    await show('/face-proof');
    await press('Begin');
    expect(screen.getByText('No face checks left today — try again tomorrow.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  test('with no tries left the camera stays off and there is nothing to press', async () => {
    engine.face.triesLeft = 0;
    await show('/face-proof');
    expect(screen.getByText('No tries left today. Come back tomorrow.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
    expect(mockLens.on).toBe(0);
  });

  test('a room opened over the check lets the camera go, and coming back brings it again', async () => {
    await show('/face-proof');
    expect(mockLens.on).toBe(1);
    await act(async () => router.push('/war-room'));
    await settle();
    expect(mockLens.on).toBe(0);
    await act(async () => router.back());
    await settle();
    expect(mockLens.on).toBe(1);
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

describe('Deep profile', () => {
  test('the Yard answers whether they have children; the rest is sealed for the Hall', async () => {
    await show('/deep');
    expect(screen.getByText('Has children')).toBeTruthy();
    expect(screen.queryByText('Wants children')).toBeNull();
    expect(screen.getByText(/are the Hall's/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Visit the Guild House' })).toBeTruthy();
  });

  test('choosing "I have children" then showing it in the Tavern saves both', async () => {
    await show('/deep');
    await press(/^Has children/);
    const sw = screen.getByRole('switch', { name: 'Show it in the Tavern' });
    expect(sw.props.accessibilityState?.disabled).toBe(true);
    await press('I have children');
    expect(engine.deepPuts[0]).toMatchObject({ hasChildren: 'yes', showChildren: null, wantsChildren: null });
    await press(/^Has children/);
    await fireEvent.press(screen.getByRole('switch', { name: 'Show it in the Tavern' }));
    await settle();
    expect(engine.deepPuts.at(-1)).toMatchObject({ showChildren: true, hasChildren: null });
    await show('/deep');
    expect(screen.getByText('Yes · shown in the Tavern')).toBeTruthy();
  });

  test('a member sees all three children questions', async () => {
    engine.deep.open = true;
    await show('/deep');
    for (const q of ['Has children', 'Wants children', "A partner's children", 'Smoking'])
      expect(screen.getByText(q)).toBeTruthy();
  });
});
