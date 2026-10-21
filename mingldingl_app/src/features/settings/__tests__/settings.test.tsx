import { act, fireEvent, screen } from 'expo-router/testing-library';
import WorldLayout from '@/app/(world)/_layout';
import { getAppStatus, getGetAppStatusQueryKey } from '@/lib/api/generated/engine';
import type { CodexPageView, MembershipView, MeView, ProfileView } from '@/lib/api/generated/model';
import { setLocale } from '@/lib/i18n';
import { applyLiveEvent } from '@/lib/live/events';
import { settle, showWorld } from '@/lib/testing/world';
import QuestLog from '../../bonds/QuestLog';
import CharacterScreen from '../../character/CharacterScreen';
import Missions from '../../road/Missions';
import SeekScreen from '../../seek/SeekScreen';
import SquareTab from '../../square/SquareTab';
import WorldTabs from '../../world/WorldTabs';
import Away from '../Away';
import Codex, { CodexPage } from '../Codex';
import Departing, { daysLeft, moonDate } from '../Departing';
import GuildHouse from '../GuildHouse';
import WarRoom from '../WarRoom';

jest.mock('@/lib/feedback', () => ({
  feedback: jest.fn(),
  deviceFeel: () => ({ sound: false, haptics: true }),
  saveSoundSetting: jest.fn(),
  saveHapticsSetting: jest.fn(),
}));
jest.mock('@/lib/push', () => ({
  ...jest.requireActual('@/lib/push'),
  pushIsOn: async () => false,
  setPushOn: jest.fn(async () => true),
}));
jest.mock('@/lib/i18n/device', () => ({ chooseLocale: jest.fn() }));
jest.mock('@/lib/links', () => ({
  ...jest.requireActual('@/lib/links'),
  manageStore: jest.fn(),
  hasLegalPages: true,
  onApple: false,
  openLegal: jest.fn(),
}));
// RevenueCat's SDK is ESM jest cannot load; the store here is open and has no prices of its own.
jest.mock('@/lib/store', () => ({
  productId: (floor: string, months: number) => `${floor}:m${months}`,
  storeOpen: () => true,
  storeSignIn: async () => {},
  storePrices: async () => ({}),
  buy: jest.fn(),
}));
jest.mock('@/lib/session', () => ({ ...jest.requireActual('@/lib/session'), signOutLocally: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };
const { saveSoundSetting } = jest.requireMock('@/lib/feedback') as { saveSoundSetting: jest.Mock };
const { setPushOn } = jest.requireMock('@/lib/push') as { setPushOn: jest.Mock };
const { chooseLocale } = jest.requireMock('@/lib/i18n/device') as { chooseLocale: jest.Mock };
const { manageStore, openLegal } = jest.requireMock('@/lib/links') as {
  manageStore: jest.Mock;
  openLegal: jest.Mock;
};

const PAGES: CodexPageView[] = [
  {
    slug: 'fire',
    kind: 'guide',
    title: 'The fire and the cold',
    summary: 'Why silence has a cost',
    body: 'Answer within two days.',
  },
  {
    slug: 'terms',
    kind: 'legal',
    title: 'Terms of the hold',
    summary: 'Terms · Privacy',
    body: 'Your number proves you are one person.',
  },
];

const DAY = 86_400_000;

/** A finished account and the routes the War Room calls; it records every write. */
function fakeEngine() {
  const e = {
    profile: {
      name: 'Bat',
      birthDate: '1995-03-14',
      age: 31,
      gender: 'Male',
      bio: 'I keep a falcon.',
      city: 'Bayangol',
      oath: 'Bond',
      oathSwornAt: '2026-10-06T00:00:00Z',
      oathProvenAt: null,
      locale: 'en',
      points: 0,
      tier: 'Garnet',
      tierUpPending: null,
      paused: false,
      awayUntil: null as string | null,
      awayNextAt: null as string | null,
      createdAt: '2026-10-06T00:00:00Z',
    } as ProfileView,
    deleteAt: null as string | null,
    membership: { floor: 'yard', until: null, source: null, renews: false, open: true } as MembershipView,
    writes: [] as string[],
    puts: [] as Record<string, unknown>[],
  };
  const me = (): MeView => ({
    accountId: 'acc',
    status: 'Active',
    phoneHint: '9911',
    deleteAt: e.deleteAt,
    profile: { ...e.profile },
    onboardingStep: 7,
  });
  apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const key = `${init.method} ${url}`;
    if (init.method !== 'GET' && key !== 'POST /me/dawn') e.writes.push(key);
    switch (key) {
      case 'GET /me':
        return me();
      case 'POST /me/away':
        e.profile.awayUntil = new Date(Date.now() + body.days * DAY).toISOString();
        e.profile.awayNextAt = new Date(Date.now() + 30 * DAY).toISOString();
        return me();
      case 'DELETE /me/away':
        e.profile.awayUntil = null;
        return me();
      case 'PUT /me':
        e.puts.push(body);
        if (typeof body.paused === 'boolean') e.profile.paused = body.paused;
        return me();
      case 'POST /me/abandon':
        e.deleteAt = new Date(Date.now() + 30 * DAY).toISOString();
        return undefined;
      case 'POST /auth/sign-out':
        return undefined;
      case 'POST /me/keep':
        e.deleteAt = null;
        return undefined;
      case 'GET /me/membership':
        return { membership: e.membership, offers: [] };
      case 'GET /me/photos':
        return [];
      case 'GET /app/status':
        return {
          minVersion: '1.0.0',
          maintenance: false,
          photosMin: 3,
          photosMax: 6,
          restMinutes: 0,
          deleteDays: 30,
          finishedPoints: 50,
        };
      case 'POST /me/dawn':
        return { earned: 0, streak: 1, seventh: false };
      case 'GET /tiers':
        return [{ name: 'Garnet', points: 0, candles: 5 }];
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
      case 'GET /codex?locale=en':
        return PAGES;
      case 'GET /codex/fire?locale=en':
        return PAGES[0];
      case 'GET /codex/terms?locale=en':
        return PAGES[1];
      default:
        throw new Error(`unexpected ${key}`);
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
  '(world)/war-room': WarRoom,
  '(world)/away': Away,
  '(world)/departing': Departing,
  '(world)/guild-house': GuildHouse,
  '(world)/codex/index': Codex,
  '(world)/codex/[slug]': CodexPage,
};

// The gate only opens the world once /app/status is in the cache too.
const STATUS = { queryKey: getGetAppStatusQueryKey(), queryFn: () => getAppStatus() };
const show = (url = '/war-room') => showWorld(ROUTES, url, { prefetch: [STATUS] });

const press = async (name: string | RegExp, role: 'button' | 'switch' | 'link' = 'button') => {
  await fireEvent.press(screen.getByRole(role, { name }));
  await settle();
};

let engine: ReturnType<typeof fakeEngine>;
beforeEach(() => {
  jest.clearAllMocks();
  engine = fakeEngine();
  setLocale('en');
});

describe('The War Room', () => {
  test('shows the sigil hint and the switches as they stand', async () => {
    await show();
    expect(screen.getByRole('header', { name: 'The War Room' })).toBeTruthy();
    expect(screen.getByText('+976 9911 ····')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Pause profile' }).props.accessibilityState.checked).toBe(
      false,
    );
    expect(screen.getByRole('switch', { name: 'Haptics' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('The Yard · free')).toBeTruthy();
  });

  test('pause travels with the character and redraws from the live event', async () => {
    const { client } = await show();
    await press('Pause profile', 'switch');
    expect(engine.puts).toEqual([expect.objectContaining({ paused: true, name: null })]);
    await act(() => applyLiveEvent(client, { kind: 'profile.updated', ids: ['acc'] }, jest.fn()));
    await settle();
    expect(screen.getByRole('switch', { name: 'Pause profile' }).props.accessibilityState.checked).toBe(true);
  });

  test('away by the fire: three lengths, the day it ends, and coming back early', async () => {
    await show();
    expect(screen.getByText('Off')).toBeTruthy();
    await press(/^Away by the fire/);
    expect(screen.getByText(/Once in thirty days/)).toBeTruthy();
    await press('For three days');
    expect(engine.writes).toContain('POST /me/away');
    const day = new Date(Date.now() + 3 * DAY).toLocaleDateString('en-GB', { weekday: 'long' });
    expect(screen.getByText(`Until ${day}`)).toBeTruthy();
    await press(/^Away by the fire/);
    await press('Come back now');
    expect(engine.writes).toContain('DELETE /me/away');
    expect(screen.getByText('Off')).toBeTruthy();
  });

  test('sound and notifications switch on this device only', async () => {
    await show();
    await press('Sound', 'switch');
    expect(saveSoundSetting).toHaveBeenCalledWith(true);
    await press('Notifications', 'switch');
    expect(setPushOn).toHaveBeenCalledWith(true);
    expect(engine.writes).toEqual([]);
  });

  test('the language sheet switches the app and tells the engine', async () => {
    await show();
    await press(/^Language/);
    await press('Монгол');
    expect(chooseLocale).toHaveBeenCalledWith('mn');
    expect(engine.puts).toEqual([expect.objectContaining({ locale: 'mn' })]);
  });

  test('sign out asks first, says what coming back costs, then ends this device only', async () => {
    const { signOutLocally } = jest.requireMock('@/lib/session') as { signOutLocally: jest.Mock };
    await show();
    await press(/^Sign out/);
    expect(screen.getByText('Sign out of this phone?')).toBeTruthy();
    expect(screen.getByText(/new code to this number/)).toBeTruthy();
    await press('Stay', 'link');
    expect(engine.writes).toEqual([]);
    await press(/^Sign out/);
    await press('Sign out', 'button');
    await settle();
    expect(engine.writes).toEqual(['POST /auth/sign-out']);
    expect(signOutLocally).toHaveBeenCalled();
  });

  test('abandon asks first; the scheduled page counts the days; keep undoes it', async () => {
    const { view, client } = await show();
    await press(/^Abandon this character/);
    expect(screen.getByText('Abandon this character?')).toBeTruthy();
    expect(screen.getByText(/In 30 days your portraits/)).toBeTruthy();
    await press('Abandon');
    expect(engine.writes).toEqual(['POST /me/abandon']);
    expect(view.getPathname()).toBe('/departing');
    // The engine's profile.updated is what redraws it.
    await act(() => applyLiveEvent(client, { kind: 'profile.updated', ids: ['acc'] }, jest.fn()));
    await settle();
    expect(screen.getByRole('header', { name: 'Your character will fade' })).toBeTruthy();
    expect(screen.getByText(/In 30 days it is gone for good/)).toBeTruthy();

    await press('Keep my character', 'link');
    expect(engine.writes).toEqual(['POST /me/abandon', 'POST /me/keep']);
  });

  test('a fading character shows the banner on Character, and keeping it is one tap', async () => {
    engine.deleteAt = new Date(Date.now() + 23 * DAY - 60_000).toISOString();
    await show('/character');
    expect(screen.getByText('This character fades in 23 days. Keep it?')).toBeTruthy();
    await press('Keep my character', 'link');
    expect(engine.writes).toEqual(['POST /me/keep']);
  });
});

describe('The Guild House', () => {
  const sitting = (source: 'store' | 'qpay'): MembershipView => ({
    floor: 'hall',
    until: '2026-11-20T00:00:00Z',
    source,
    renews: source === 'store',
    open: true,
  });

  test('a store floor is changed or cancelled in Google Play', async () => {
    engine.membership = sitting('store');
    await show('/guild-house');
    expect(screen.getByText(/RENEWS ON/)).toBeTruthy();
    await press('Manage in Google Play', 'link');
    expect(manageStore).toHaveBeenCalled();
  });

  test('a floor paid on the web page has nothing to manage, only the way back', async () => {
    engine.membership = sitting('qpay');
    await show('/guild-house');
    expect(screen.getByText(/PAID UNTIL/)).toBeTruthy();
    expect(screen.queryByText('Manage in Google Play')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to the War Room' })).toBeTruthy();
  });
});

describe('The Codex', () => {
  test('lists the guides (not the terms) and opens a page on parchment', async () => {
    const { view } = await show('/codex');
    expect(await screen.findByText('The fire and the cold')).toBeTruthy();
    expect(screen.queryByText('Terms of the hold')).toBeNull();
    await press(/The fire and the cold/);
    expect(view.getPathname()).toBe('/codex/fire');
    expect(await screen.findByText('Answer within two days.')).toBeTruthy();
  });

  test('the terms read under Help & Legal', async () => {
    await show('/codex/terms');
    expect(await screen.findByRole('header', { name: 'Help & Legal' })).toBeTruthy();
    expect(screen.getByText('Your number proves you are one person.')).toBeTruthy();
    await press('Read the privacy policy', 'link');
    expect(openLegal).toHaveBeenCalledWith('privacy');
    await press('Read the full terms', 'link');
    expect(openLegal).toHaveBeenCalledWith('terms');
  });
});

describe('Departure dates', () => {
  test('days left round up and never reach zero while pending', () => {
    const now = Date.parse('2026-10-10T12:00:00Z');
    expect(daysLeft('2026-11-09T12:00:00Z', now)).toBe(30);
    expect(daysLeft('2026-11-09T11:00:00Z', now)).toBe(30);
    expect(daysLeft('2026-10-10T12:00:01Z', now)).toBe(1);
    expect(daysLeft('2026-10-09T12:00:00Z', now)).toBe(1);
  });

  test('the day reads as a moon', () => {
    expect(moonDate('2026-11-04T10:00:00Z')).toBe('Deletion on the 4th of the eleventh moon');
    expect(moonDate('2026-01-22T10:00:00Z')).toBe('Deletion on the 22nd of the first moon');
    expect(moonDate('2026-03-13T10:00:00Z')).toBe('Deletion on the 13th of the third moon');
    expect(moonDate('2026-05-01T10:00:00Z')).toBe('Deletion on the 1st of the fifth moon');
  });
});
