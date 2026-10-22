import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { BackHandler } from 'react-native';
import { ApiError } from '@/lib/api/client';
import { getAppStatus, getGetAppStatusQueryKey, getGetMeQueryKey, getMe } from '@/lib/api/generated/engine';
import type { CityView, MeView, PhotoView, ProfileView } from '@/lib/api/generated/model';
import { type CityRow, cityLabel, cityRows, nearestCity } from '../cities';
import Onboarding from '../Onboarding';
import { ageOn, formatBorn, parseBorn } from '../steps/NameAge';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  CameraType: { front: 'front', back: 'back' },
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const mockTakePicture = jest.fn(async (_o?: unknown) => ({ uri: 'file:///now.jpg', base64: '/9j/' }));
jest.mock('expo-camera', () => {
  const { forwardRef, useEffect, useImperativeHandle } = jest.requireActual('react');
  return {
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
    CameraView: forwardRef((props: { onCameraReady?: () => void }, ref: unknown) => {
      useImperativeHandle(ref, () => ({ takePictureAsync: (o: unknown) => mockTakePicture(o) }));
      useEffect(() => props.onCameraReady?.(), []);
      return null;
    }),
  };
});
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };
const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const location = Location as jest.Mocked<typeof Location>;

const CITIES: CityView[] = [
  { name: 'Ulaanbaatar', kind: 'capital', region: 'Ulaanbaatar', lat: 47.9184, lng: 106.9177 },
  { name: 'Bayangol', kind: 'district', region: 'Ulaanbaatar', lat: 47.8975, lng: 106.8794 },
  { name: 'Khan-Uul', kind: 'district', region: 'Ulaanbaatar', lat: 47.8697, lng: 106.8794 },
  { name: 'Sükhbaatar (UB)', kind: 'district', region: 'Ulaanbaatar', lat: 47.9184, lng: 106.9153 },
  { name: 'Tsetserleg', kind: 'province', region: 'Arkhangai', lat: 47.4767, lng: 101.4571 },
  { name: 'Ölgii', kind: 'province', region: 'Bayan-Ölgii', lat: 48.97, lng: 89.95 },
  { name: 'Erdenet', kind: 'province', region: 'Orkhon', lat: 49.0333, lng: 104.0833 },
];

/** A tiny engine: the routes onboarding calls, with the real step rule (ProfileService.OnboardingStep). */
function fakeEngine() {
  const e = {
    profile: null as ProfileView | null,
    photos: [] as PhotoView[],
    welcomed: false,
    creates: 0,
    uploads: [] as string[],
    failUploads: 0,
    /** An engine rule code every upload is refused with (e.g. photos.no_face). */
    refuseUploads: null as string | null,
    /** The photo list as it was before any upload: a refetch that has not caught up yet. */
    staleList: null as PhotoView[] | null,
    min: 3,
  };
  const step = () => {
    const p = e.profile;
    if (!p) return 1;
    if (!p.gender) return 2;
    if (e.photos.length < e.min) return 3;
    if (!p.bio || !p.city) return 4;
    if (!p.oath) return 5;
    return e.welcomed ? 7 : 6;
  };
  const me = (): MeView => ({
    accountId: 'acc',
    status: 'Active',
    phoneHint: '9911',
    deleteAt: null,
    profile: e.profile,
    onboardingStep: step(),
  });
  const route = async (url: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const key = `${init.method} ${url}`;
    switch (key) {
      case 'GET /me':
        return me();
      case 'POST /me':
        e.creates++;
        e.profile = {
          name: body.name,
          birthDate: body.birthDate,
          age: 30,
          gender: null,
          bio: null,
          city: null,
          oath: null,
          oathSwornAt: null,
          oathProvenAt: null,
          locale: body.locale,
          points: 0,
          tier: 'Garnet',
          tierUpPending: null,
          paused: false,
          awayUntil: null,
          awayNextAt: null,
          faceProvenAt: null,
          createdAt: '2026-10-06T00:00:00Z',
        };
        return me();
      case 'PUT /me': {
        const p = e.profile as ProfileView;
        for (const k of ['name', 'gender', 'bio', 'city', 'oath'] as const)
          if (body[k] !== null) p[k] = body[k];
        if (body.welcomed) e.welcomed = true;
        return me();
      }
      case 'GET /me/photos':
        return e.staleList ?? e.photos;
      case 'POST /me/photos': {
        const idem = new Headers(init.headers).get('Idempotency-Key') as string;
        e.uploads.push(idem);
        if (e.failUploads > 0) {
          e.failUploads--;
          throw new ApiError('network', 0, 'network', 'dropped');
        }
        if (e.refuseUploads) throw new ApiError('rule', 400, e.refuseUploads, 'refused');
        const photo = {
          id: `p-${idem}`,
          url: 'u',
          expiresAt: '',
          thumbHash: '',
          width: 3,
          height: 4,
          position: 0,
        };
        if (!e.photos.some((x) => x.id === photo.id)) e.photos.push(photo);
        return photo;
      }
      case 'GET /geo/cities':
        return CITIES;
      case 'GET /app/status':
        return {
          minVersion: '1.0.0',
          maintenance: false,
          photosMin: e.min,
          photosMax: 6,
          finishedPoints: 50,
        };
      default:
        throw new Error(`unrouted ${key}`);
    }
  };
  apiFetch.mockImplementation(route);
  return { e, me };
}

const photo = (id: string): PhotoView => ({
  id,
  url: 'u',
  expiresAt: '',
  thumbHash: '',
  width: 3,
  height: 4,
  position: 0,
});

async function show() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
      mutations: { retry: false },
    },
  });
  // The gate only renders onboarding once /me and /app/status are in the cache.
  await client.prefetchQuery({ queryKey: getGetMeQueryKey(), queryFn: () => getMe() });
  await client.prefetchQuery({ queryKey: getGetAppStatusQueryKey(), queryFn: () => getAppStatus() });
  await render(
    <QueryClientProvider client={client}>
      <Onboarding />
    </QueryClientProvider>,
  );
  await settle();
  return client;
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));
const press = async (name: string | RegExp) => {
  await fireEvent.press(screen.getByRole('button', { name }));
  await settle();
};
const addPortrait = async () => {
  const [first] = screen.getAllByRole('button', { name: 'Add a portrait' });
  await fireEvent.press(first as never);
  await settle();
  await press('Choose from your photos');
};
const header = (name: string) => screen.getByRole('header', { name });

let engine: ReturnType<typeof fakeEngine>;
beforeEach(() => {
  jest.clearAllMocks();
  engine = fakeEngine();
});

describe('Onboarding', () => {
  test('renders the step the server is on', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    await show();
    expect(header('Your portraits')).toBeTruthy();
    expect(screen.getByText('3 of 6')).toBeTruthy();
  });

  test("the name's Next key moves on to Born (a hidden field below the keyboard scrolls into view)", async () => {
    const { TextInput } = require('react-native');
    await show();
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    focus.mockClear();
    await fireEvent(screen.getByLabelText('First name'), 'submitEditing');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(engine.e.creates).toBe(0);
  });

  test('going back to step 1 and forward again renames, never re-creates', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Мөнхболд');
    await fireEvent.changeText(screen.getByLabelText('Born'), '14031995');
    await press('Continue');
    expect(engine.e.creates).toBe(1);
    expect(header('You are…')).toBeTruthy();

    await press('Back');
    expect(header('What does the hold call you?')).toBeTruthy();
    expect(screen.getByDisplayValue('Мөнхболд')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Болд');
    await press('Continue');
    expect(engine.e.creates).toBe(1);
    expect(engine.e.profile?.name).toBe('Болд');
    expect(header('You are…')).toBeTruthy();
  });

  test('a tale typed on step 4 survives going back a step and returning', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    await show();
    expect(header('Your tale')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Your tale'), 'I ride at dawn.');
    await press('Back');
    expect(await screen.findByText('3 of 3 needed · up to 6')).toBeTruthy();
    await press('Continue');
    expect(header('Your tale')).toBeTruthy();
    expect(screen.getByDisplayValue('I ride at dawn.')).toBeTruthy();
  });

  test("Android's back button steps back a step instead of leaving the app", async () => {
    const add = jest.spyOn(BackHandler, 'addEventListener');
    engine.e.profile = { ...base(), gender: 'Male' };
    await show();
    expect(header('Your portraits')).toBeTruthy();
    const handler = add.mock.calls.at(-1)?.[1] as () => boolean;
    let handled = false;
    await act(async () => {
      handled = handler();
    });
    expect(handled).toBe(true);
    expect(header('You are…')).toBeTruthy();
    add.mockRestore();
  });

  test('an under-18 birth date is stopped before the engine is asked', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Saruul');
    const year = new Date().getFullYear() - 17;
    await fireEvent.changeText(screen.getByLabelText('Born'), `0101${year}`);
    await press('Continue');
    expect(engine.e.creates).toBe(0);
    expect(screen.getByText('You must be 18 or older.')).toBeTruthy();
  });

  test('a birth year no living person has is a bad date, not an age rule', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Saruul');
    await fireEvent.changeText(screen.getByLabelText('Born'), '01011900');
    await press('Continue');
    expect(engine.e.creates).toBe(0);
    expect(screen.getByText('Enter the day, month and year you were born.')).toBeTruthy();
  });

  test('an empty frame offers the camera as well as the photos, and a photo taken goes up', async () => {
    engine.e.profile = { ...base(), gender: 'Female' };
    await show();

    const [first] = screen.getAllByRole('button', { name: 'Add a portrait' });
    await fireEvent.press(first as never);
    await settle();
    await press('Take a photo');
    await press('Take the photo');
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(engine.e.uploads).toHaveLength(1);
  });

  test('a failed upload retries with the same Idempotency-Key', async () => {
    engine.e.profile = { ...base(), gender: 'Female' };
    engine.e.failUploads = 1;
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', base64: '/9j/' }],
    } as never);
    await show();

    await addPortrait();
    expect(engine.e.uploads).toHaveLength(1);
    const first = engine.e.uploads[0];
    expect(screen.getByText('The portrait did not arrive. Tap to try again.')).toBeTruthy();

    await press('Lost — tap');
    expect(engine.e.uploads.filter((k) => k === first)).toHaveLength(2);
    expect(engine.e.photos.map((p) => p.id)).toContain(`p-${first}`);
  });

  test('portraits picked together stay in the order picked, in their slots, even before the list refetches', async () => {
    engine.e.profile = { ...base(), gender: 'Female' };
    engine.e.staleList = [];
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', base64: '/9j/a' },
        { uri: 'file:///b.jpg', base64: '/9j/b' },
      ],
    } as never);
    await show();

    await addPortrait();
    expect(engine.e.uploads).toHaveLength(2);
    expect(screen.queryByLabelText('Uploading the portrait')).toBeNull();
    const [a, b] = engine.e.uploads;
    expect(screen.getByLabelText('Portrait 1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Portrait 2 of 2')).toBeTruthy();
    expect(engine.e.photos.map((x) => x.id)).toEqual([`p-${a}`, `p-${b}`]);
    expect(screen.getAllByRole('button', { name: 'Add a portrait' })).toHaveLength(4);
  });

  test('a photo the engine refuses leaves the grid with its reason, not a retry', async () => {
    engine.e.profile = { ...base(), gender: 'Female' };
    engine.e.refuseUploads = 'photos.no_face';
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///drawing.jpg', base64: '/9j/' }],
    } as never);
    await show();

    await addPortrait();
    expect(
      screen.getByText('We could not find a face in this portrait. Choose one that shows you.'),
    ).toBeTruthy();
    expect(screen.queryByText('Lost — tap')).toBeNull();
    expect(screen.queryByText('The portrait did not arrive. Tap to try again.')).toBeNull();
    expect(screen.queryByLabelText('Uploading the portrait')).toBeNull();
  });

  test('photo access refused shows how to allow it', async () => {
    engine.e.profile = { ...base(), gender: 'Female' };
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await show();
    await addPortrait();
    expect(screen.getByText('Allow access to your photos to choose your portraits.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open settings' })).toBeTruthy();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  test.each([
    [0, '0 of 3 needed · up to 6'],
    [2, '2 of 3 needed · up to 6'],
    [3, '3 of 3 needed · up to 6'],
    [4, '4 of 6'],
    [6, '6 of 6'],
  ])('the counter with %i portraits reads "%s"', async (n, copy) => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = Array.from({ length: n }, (_, i) => photo(`p${i}`));
    // Past the minimum the server is on step 4; going back to the portraits shows the same counter.
    await show();
    if (n >= 3) await press('Back');
    expect(await screen.findByText(copy)).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Add a portrait' })).toHaveLength(6 - n);
  });

  test('the third portrait arriving does not pull the person off the step; Continue does', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b')];
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///c.jpg', base64: '/9j/' }],
    } as never);
    await show();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await addPortrait();
    expect(await screen.findByText('3 of 3 needed · up to 6')).toBeTruthy();
    expect(header('Your portraits')).toBeTruthy();

    await press('Continue');
    expect(header('Your tale')).toBeTruthy();
  });

  test('location refused says so and keeps the list to pick from', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await show();
    expect(header('Your tale')).toBeTruthy();

    await press('Where you live');
    await fireEvent.press(screen.getByRole('link', { name: 'Use my location' }));
    await settle();
    expect(screen.getByText('Location is off. Pick the city you call home.')).toBeTruthy();
    await press('Arkhangai');
    expect(screen.getByDisplayValue('Tsetserleg, Arkhangai')).toBeTruthy();
  });

  test('opening the city picker puts away the keys the tale left up', async () => {
    const { Keyboard } = require('react-native');
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    await show();
    dismiss.mockClear();
    await press('Where you live');
    expect(dismiss).toHaveBeenCalled();
  });

  test('a search with no match says so instead of showing an empty list', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    await show();
    await press('Where you live');
    // Uncontrolled on purpose (see CityPicker): the overlay renders it a commit late.
    expect(screen.getByLabelText('Search a city or soum').props.value).toBeUndefined();
    await fireEvent.changeText(screen.getByLabelText('Search a city or soum'), 'Paris');
    expect(screen.getByText('No place called “Paris”. Try another spelling.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search a city or soum'), 'arhang');
    expect(screen.queryByText(/No place called/)).toBeNull();
  });

  test('Ulaanbaatar opens to its districts, and a district is picked inside it', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    await show();
    await press('Where you live');
    expect(screen.queryByText('Khan-Uul')).toBeNull();
    await press('Ulaanbaatar');
    expect(screen.getByRole('button', { name: 'Ulaanbaatar' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByText('All of Ulaanbaatar')).toBeTruthy();
    await press('Khan-Uul');
    expect(screen.getByDisplayValue('Khan-Uul, Ulaanbaatar')).toBeTruthy();
  });

  test('location allowed picks the nearest listed place', async () => {
    engine.e.profile = { ...base(), gender: 'Male' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true } as never);
    location.getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 49.02, longitude: 104.05 },
    } as never);
    await show();
    await press('Where you live');
    await fireEvent.press(screen.getByRole('link', { name: 'Use my location' }));
    await settle();
    expect(screen.getByDisplayValue('Erdenet, Orkhon')).toBeTruthy();
  });

  test('the oath and welcome finish onboarding through the engine', async () => {
    engine.e.profile = { ...base(), gender: 'Male', bio: 'b', city: 'Bayangol' };
    engine.e.photos = [photo('a'), photo('b'), photo('c')];
    await show();
    expect(header('Swear your oath')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Swear the oath' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kinship' }));
    await press('Swear the oath');
    expect(engine.e.profile?.oath).toBe('Kinship');
    expect(screen.getByText('Your tale is written in full.')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
    await press('Enter the Hearth');
    expect(engine.e.welcomed).toBe(true);
  });
});

describe('dates and places', () => {
  test('birth dates format as typed and reject days that do not exist', () => {
    expect(formatBorn('1403')).toBe('14 · 03');
    expect(formatBorn('14031995')).toBe('14 · 03 · 1995');
    expect(parseBorn('14031995')).toBe('1995-03-14');
    expect(parseBorn('31022000')).toBeNull();
    expect(parseBorn('1403199')).toBeNull();
    expect(ageOn('2008-10-07', new Date(2026, 9, 6))).toBe(17);
    expect(ageOn('2008-10-06', new Date(2026, 9, 6))).toBe(18);
  });

  test('Ulaanbaatar sits first among the provinces, its districts tiered inside it', () => {
    const read = (rows: CityRow[]) =>
      rows.map((r) =>
        r.kind === 'capital'
          ? `${r.city.name} ${r.open ? 'v' : '>'}`
          : r.kind === 'whole'
            ? '  (whole)'
            : r.nested
              ? `  ${r.label}`
              : r.label,
      );
    expect(read(cityRows(CITIES, '', false))).toEqual([
      'Ulaanbaatar >',
      'Arkhangai',
      'Bayan-Ölgii',
      'Orkhon',
    ]);
    expect(read(cityRows(CITIES, '', true))).toEqual([
      'Ulaanbaatar v',
      '  (whole)',
      '  Bayangol',
      '  Khan-Uul',
      '  Sükhbaatar',
      'Arkhangai',
      'Bayan-Ölgii',
      'Orkhon',
    ]);
    // A district match opens the capital to just that district; the capital's own name opens all of it.
    expect(read(cityRows(CITIES, 'uul', false))).toEqual(['Ulaanbaatar v', '  Khan-Uul']);
    expect(read(cityRows(CITIES, 'ulaan', false))).toHaveLength(5);
    // "ub" is not part of a district's name; it only told Sükhbaatar (UB) apart from Selenge's.
    expect(read(cityRows(CITIES, 'ub', false))).toEqual([]);
    expect(read(cityRows(CITIES, 'olgii', false))).toEqual(['Ölgii, Bayan-Ölgii']);
    expect(read(cityRows(CITIES, 'erd', false))).toEqual(['Erdenet, Orkhon']);
    // Mongolians often write х as a plain h: Arhangai, Orhon, Suhbaatar find the kh spellings.
    expect(read(cityRows(CITIES, 'arhang', false))).toEqual(['Tsetserleg, Arkhangai']);
    expect(read(cityRows(CITIES, 'suhbaatar', false))).toEqual(['Ulaanbaatar v', '  Sükhbaatar']);
    expect(cityLabel(CITIES[0] as CityView)).toBe('Ulaanbaatar');
    expect(cityLabel(CITIES[3] as CityView)).toBe('Sükhbaatar, Ulaanbaatar');
    expect(nearestCity(CITIES, 47.9, 106.88)?.name).toBe('Bayangol');
  });
});

function base(): ProfileView {
  return {
    name: 'Мөнхболд',
    birthDate: '1995-03-14',
    age: 31,
    gender: null,
    bio: null,
    city: null,
    oath: null,
    oathSwornAt: null,
    oathProvenAt: null,
    locale: 'en',
    points: 0,
    tier: 'Garnet',
    tierUpPending: null,
    paused: false,
    awayUntil: null,
    awayNextAt: null,
    faceProvenAt: null,
    createdAt: '2026-10-06T00:00:00Z',
  };
}
