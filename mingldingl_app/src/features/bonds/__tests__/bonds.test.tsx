import { act, fireEvent, screen } from 'expo-router/testing-library';
import WorldLayout from '@/app/(world)/_layout';
import type { BondRow, BondView, LetterView, SeekView } from '@/lib/api/generated/model';
import { applyLiveEvent } from '@/lib/live/events';
import { shouldAskToRing } from '@/lib/push';
import { ME, settle, showWorld } from '@/lib/testing/world';
import { toast } from '@/lib/toast';
import BondMade from '../../ceremonies/BondMade';
import SealBroken from '../../ceremonies/SealBroken';
import RingScreen from '../../push/RingScreen';
import SeekScreen, { candleLine } from '../../seek/SeekScreen';
import WorldTabs from '../../world/WorldTabs';
import BondScreen, { itemsOf } from '../BondScreen';
import Companion from '../Companion';
import QuestLog, { lineOf } from '../QuestLog';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));
jest.mock('@/lib/toast', () => ({ ...jest.requireActual('@/lib/toast'), toast: jest.fn() }));

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };
const { ApiError } = jest.requireActual('@/lib/api/client');

const portrait = (id: string, url: string | null = null) => ({
  id,
  position: 0,
  thumbHash: 'OwgKBwDUj1N4d4icRXeHiHiICE/r0OAO',
  width: 4,
  height: 5,
  url,
  expiresAt: url ? '2026-10-07T12:00:00Z' : null,
});

const companion: SeekView = {
  state: 'companion',
  candidate: {
    accountId: 'saruul',
    age: 28,
    tier: 'Amethyst',
    place: 'Ulaanbaatar',
    oath: 'Bond',
    bio: 'Walks out onto Khövsgöl’s ice every winter to hear it sing.',
    portrait: portrait('p1'),
    hasChildren: false,
  },
  candlesLeft: 4,
  candlesPerDay: 5,
  nextDawnAt: '2026-10-07T16:00:00Z',
  seatsUsed: 1,
  seats: 5,
  floor: 'yard',
  secondLook: false,
  filtered: false,
};

const bond = (over: Partial<BondView> = {}): BondView => ({
  id: 'b1',
  state: 'Live',
  other: {
    accountId: 'saruul',
    name: 'Saruul',
    age: 28,
    tier: 'Amethyst',
    oath: 'Bond',
    bio: 'falcon',
    place: 'Ulaanbaatar',
    portraits: [portrait('p1'), portrait('p2'), portrait('p3')],
    hasChildren: false,
    awayUntil: null,
    deep: null,
  },
  seals: 0,
  mutual: 0,
  nextSealAt: 5,
  sealLadder: [5, 10, 15, 30],
  myLetters: 0,
  theirLetters: 0,
  myTurn: false,
  embers: false,
  coldAt: null,
  createdAt: '2026-10-07T01:00:00Z',
  closedAt: null,
  closedByMe: false,
  summonedByMe: true,
  closedWhy: null,
  candleBack: false,
  ...over,
});

const letter = (id: string, mine: boolean, at: string, sealBroken: number | null = null): LetterView => ({
  id,
  mine,
  text: `text ${id}`,
  sealBroken,
  createdAt: at,
});

type World = { seek: SeekView; bonds: BondRow[]; bond: BondView; letters: LetterView[]; posts: string[] };

function fakeEngine(): World {
  const w: World = { seek: companion, bonds: [], bond: bond(), letters: [], posts: [] };
  apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.split('?')[0] ?? url;
    const key = `${init.method} ${path}`;
    if (init.method === 'POST') w.posts.push(path);
    switch (key) {
      case 'GET /me':
        return ME;
      case 'GET /me/photos':
        return [];
      case 'POST /me/dawn':
        return { earned: 0, streak: 1, seventh: false };
      case 'GET /tiers':
        return [];
      case 'GET /seek':
        return w.seek;
      case 'POST /seek/saruul/summon':
        return w.bond;
      case 'POST /seek/saruul/pass':
        return undefined;
      case 'GET /bonds':
        return w.bonds;
      case 'GET /bonds/b1':
        return w.bond;
      case 'GET /bonds/b1/letters':
        return { items: w.letters, nextBefore: null };
      case 'POST /bonds/b1/read':
        return undefined;
      case 'POST /bonds/b1/letters':
        return letter('new', true, new Date().toISOString());
      default:
        throw new Error(`unrouted ${key}`);
    }
  });
  return w;
}

const ROUTES = {
  '(world)/_layout': WorldLayout,
  '(world)/(tabs)/_layout': WorldTabs,
  '(world)/(tabs)/seek': SeekScreen,
  '(world)/(tabs)/quests': QuestLog,
  '(world)/(tabs)/missions': () => null,
  '(world)/(tabs)/square': () => null,
  '(world)/(tabs)/character': () => null,
  '(world)/bond/[id]': BondScreen,
  '(world)/companion/[id]': Companion,
  '(world)/ceremony/bond/[id]': BondMade,
  '(world)/ceremony/seal/[id]': SealBroken,
  '(world)/ring': RingScreen,
  '(world)/codex/[slug]': () => null,
};

// Screens here chain fetches (the bond, then its letters, then a read receipt).
const show = (url: string) => showWorld(ROUTES, url, { settles: 4 });

const WRITE = 'Write the first letter';
let w: World;
beforeEach(() => {
  jest.clearAllMocks();
  w = fakeEngine();
});

describe('Seek', () => {
  test('a companion shows sealed and nameless, and Summon opens the bond ceremony', async () => {
    const { view } = await show('/seek');
    expect(screen.getByText('A traveller, 28')).toBeTruthy();
    expect(screen.queryByText(/Saruul/)).toBeNull();
    expect(screen.getByText('Amethyst  ·  Ulaanbaatar')).toBeTruthy();
    expect(screen.getByLabelText('4 candles left tonight')).toBeTruthy();
    expect(screen.getByLabelText("A traveller's sealed portrait")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Summon' }));
    await settle();
    await settle();
    expect(w.posts).toContain('/seek/saruul/summon');
    expect(view.getPathname()).toBe('/ceremony/bond/b1');
    expect(screen.getByText('A bond is made')).toBeTruthy();
  });

  test('has children shows on the card only when they chose to show it', async () => {
    await show('/seek');
    expect(screen.queryByText('Has children')).toBeNull();
    const candidate = companion.candidate;
    if (!candidate) throw new Error('the fixture has a companion');
    w.seek = { ...companion, candidate: { ...candidate, hasChildren: true } };
    await show('/seek');
    expect(screen.getByText('Has children')).toBeTruthy();
  });

  test('the first bond asks to ring once, then goes where the person chose', async () => {
    const { requestPermissionsAsync } = jest.requireMock('expo-notifications') as {
      requestPermissionsAsync: jest.Mock;
    };
    const { view } = await show('/ceremony/bond/b1');
    await fireEvent.press(screen.getByRole('button', { name: WRITE }));
    await settle();
    expect(view.getPathname()).toBe('/ring');
    expect(screen.getByText('May we ring for you?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ring for me' }));
    await settle();
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(view.getPathname()).toBe('/bond/b1');
    // asked once per device: the next bond goes straight to its letters
    expect(await shouldAskToRing()).toBe(false);
  });

  test('a refused summons says why in the person’s words', async () => {
    apiFetch.mockImplementationOnce(async () => companion);
    const real = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === '/seek/saruul/summon') throw new ApiError('rule', 409, 'seek.fire_full', 'full');
      return real?.(url, init);
    });
    await show('/seek');
    await fireEvent.press(screen.getByRole('button', { name: 'Summon' }));
    await settle();
    expect(toast).toHaveBeenCalledWith('error', 'Your fire is full. Close a bond before you summon another.');
  });

  test('candles are counted only when few are left', () => {
    expect(candleLine(1)).toBe('1 candle left tonight');
    expect(candleLine(5)).toBe('5 candles left tonight');
    expect(candleLine(38)).toBe('Candles to spare tonight');
  });

  test('no candles: the realm rests until dawn; a full fire points to the Quest Log', async () => {
    w.seek = { ...companion, state: 'rests', candidate: null, candlesLeft: 0 };
    const { client } = await show('/seek');
    expect(screen.getByText('The realm rests')).toBeTruthy();
    expect(screen.getByText(/New candles at dawn/)).toBeTruthy();
    w.seek = { ...companion, state: 'full', candidate: null };
    await act(() => applyLiveEvent(client, { kind: 'seek.changed', ids: ['me'] }, jest.fn()));
    await settle();
    expect(screen.getByText('Your fire is full')).toBeTruthy();
    expect(screen.getByText('Open the Quest Log')).toBeTruthy();
    w.seek = { ...companion, state: 'empty', candidate: null };
    await act(() => applyLiveEvent(client, { kind: 'seek.changed', ids: ['me'] }, jest.fn()));
    await settle();
    expect(screen.getByText('The tavern is empty')).toBeTruthy();
  });
});

describe('Quest Log', () => {
  const row = (over: Partial<BondRow>): BondRow => ({
    id: 'b1',
    state: 'Live',
    otherId: 'saruul',
    otherName: 'Saruul',
    otherPortrait: portrait('p1'),
    seals: 0,
    lastLetter: null,
    lastLetterMine: false,
    lastLetterAt: null,
    myTurn: false,
    unread: false,
    embers: false,
    coldAt: null,
    createdAt: new Date().toISOString(),
    closedAt: null,
    ...over,
  });

  test('sorts bonds by whose turn it is and raises the most urgent embers', async () => {
    const soon = new Date(Date.now() + 5 * 3_600_000).toISOString();
    w.bonds = [
      row({
        id: 'a',
        otherName: 'Saruul',
        lastLetter: 'Sunday, then.',
        lastLetterAt: new Date().toISOString(),
        myTurn: true,
        unread: true,
        embers: true,
        coldAt: soon,
      }),
      row({
        id: 'b',
        otherName: 'Tsetseg',
        lastLetter: 'The map is ready.',
        lastLetterMine: true,
        lastLetterAt: new Date().toISOString(),
      }),
      row({ id: 'c', otherName: 'Oyun', state: 'Cold', closedAt: new Date().toISOString() }),
    ];
    await show('/quests');
    expect(screen.getByText('Saruul waits for your word. 5 hours before the fire dies.')).toBeTruthy();
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(screen.getByText('“Sunday, then.”')).toBeTruthy();
    expect(screen.getByText('You: “The map is ready.”')).toBeTruthy();
    expect(screen.getByText('The fire went out')).toBeTruthy();
    expect(screen.getAllByTestId('unread')).toHaveLength(1);
  });

  test('lines for every state', () => {
    expect(lineOf(row({}))).toBe('No words spoken yet');
    expect(lineOf(row({ state: 'Severed' }))).toBe('The bond was severed');
    expect(lineOf(row({ state: 'Faded' }))).toBe('The fire faded unspoken');
  });
});

describe('Bond', () => {
  test('no words yet names the first seal', async () => {
    await show('/bond/b1');
    expect(screen.getByText('No words spoken yet')).toBeTruthy();
    expect(screen.getByText(/Her portrait stays sealed until you have both spoken 5 times/)).toBeTruthy();
    expect(screen.getByText('SEALED · MATCHED TONIGHT')).toBeTruthy();
  });

  test('a letter goes out and the field clears; their newest letter is marked read', async () => {
    w.letters = [letter('l1', false, new Date().toISOString())];
    await show('/bond/b1');
    expect(w.posts).toContain('/bonds/b1/read');
    const field = screen.getByLabelText('Write a letter…');
    await fireEvent.changeText(field, 'Then bring the map.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send the letter' }));
    await settle();
    expect(w.posts).toContain('/bonds/b1/letters');
  });

  test('a seal breaking while open plays its ceremony', async () => {
    w.letters = [letter('l1', false, new Date().toISOString())];
    const { client, view } = await show('/bond/b1');
    w.bond = bond({
      seals: 1,
      mutual: 5,
      nextSealAt: 10,
      other: { ...bond().other, portraits: [portrait('p1', 'https://x/p1')] },
    });
    await act(() => applyLiveEvent(client, { kind: 'bond.updated', ids: ['b1'] }, jest.fn()));
    await settle();
    await settle();
    expect(view.getPathname()).toBe('/ceremony/seal/b1');
    expect(screen.getByText('A first portrait')).toBeTruthy();
    expect(screen.getByText('5 letters each. The next seal breaks at 10.')).toBeTruthy();
  });

  test('their header opens their character, sealed before the first seal', async () => {
    w.letters = [letter('l1', false, new Date().toISOString())];
    const { view } = await show('/bond/b1');
    await fireEvent.press(screen.getByRole('button', { name: "Open Saruul's character" }));
    await settle();
    expect(view.getPathname()).toBe('/companion/b1');
    expect(screen.getByLabelText("Saruul's sealed portrait")).toBeTruthy();
    expect(screen.getByText('Seal 1 breaks when you have both written 5 letters.')).toBeTruthy();
  });

  test('after the third seal their character shows three portraits and the district', async () => {
    w.bond = bond({
      seals: 3,
      mutual: 15,
      nextSealAt: 30,
      other: {
        ...bond().other,
        place: 'Bayangol',
        portraits: [
          portrait('p1', 'https://x/p1'),
          portrait('p2', 'https://x/p2'),
          portrait('p3', 'https://x/p3'),
        ],
      },
    });
    await show('/companion/b1');
    expect(screen.getByLabelText('Saruul, 28')).toBeTruthy();
    expect(screen.getByLabelText("Saruul's portrait 2")).toBeTruthy();
    expect(screen.getByLabelText("Saruul's portrait 3")).toBeTruthy();
    expect(screen.getByText(/Bayangol/)).toBeTruthy();
    expect(screen.getByText('Seal 4 breaks when you have both written 30 letters.')).toBeTruthy();
  });

  test('gone cold: frost, the verdict, and no more letters', async () => {
    w.letters = [letter('l1', true, new Date().toISOString())];
    w.bond = bond({ state: 'Cold', closedByMe: false, closedAt: new Date().toISOString() });
    await show('/bond/b1');
    expect(screen.getByText('GONE COLD')).toBeTruthy();
    expect(screen.getByText(/the silence was theirs, so you lose nothing/)).toBeTruthy();
    expect(screen.getByLabelText('The fire is out')).toBeTruthy();
  });

  test('they are away by the fire: the header and the notice say until when', async () => {
    const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
    w.letters = [letter('l1', true, new Date().toISOString())];
    w.bond = bond({ other: { ...bond().other, awayUntil: until } });
    await show('/bond/b1');
    const day = new Date(until).toLocaleDateString('en-GB', { weekday: 'long' });
    expect(screen.getByText(`AWAY UNTIL ${day.toUpperCase()}`)).toBeTruthy();
    expect(
      screen.getByText(`Saruul is away by the fire until ${day}. Nothing goes cold while they are gone.`),
    ).toBeTruthy();
  });

  test('a new bond links the first-letter guide', async () => {
    const { view } = await show('/bond/b1');
    await fireEvent.press(screen.getByRole('link', { name: 'How to write a first letter' }));
    await settle();
    expect(view.getPathname()).toBe('/codex/first-letter');
  });

  test('severed by you: the closed page, and the paths may cross again', async () => {
    w.bond = bond({ state: 'Severed', closedByMe: true });
    await show('/bond/b1');
    expect(screen.getByText('You let this bond go')).toBeTruthy();
    expect(screen.getByText(/after ninety days/)).toBeTruthy();
    expect(screen.queryByLabelText('Write a letter…')).toBeNull();
  });

  test('severed by them: the paths parted, with the candle given back tonight', async () => {
    w.bond = bond({ state: 'Severed', closedByMe: false, candleBack: true });
    const { view } = await show('/bond/b1');
    expect(screen.getByText('PATHS PARTED')).toBeTruthy();
    expect(screen.getByText('The paths parted')).toBeTruthy();
    expect(screen.getByText('A candle is lit again for tonight.')).toBeTruthy();
    expect(screen.queryByLabelText('Write a letter…')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the Tavern' }));
    await settle();
    expect(view.getPathname()).toBe('/seek');
  });

  test('severed by them with no candle spent tonight: no candle line', async () => {
    w.bond = bond({ state: 'Severed', closedByMe: false, candleBack: false });
    await show('/bond/b1');
    expect(screen.getByText('The paths parted')).toBeTruthy();
    expect(screen.queryByText('A candle is lit again for tonight.')).toBeNull();
  });

  test('letters read newest first with seal lines under their letter and days over their first', () => {
    const now = Date.parse('2026-10-07T12:00:00');
    const items = itemsOf(
      [
        letter('c', true, '2026-10-07T10:00:00'),
        letter('b', false, '2026-10-07T09:00:00', 1),
        letter('a', false, '2026-10-06T21:40:00'),
      ],
      now,
    );
    expect(items.map((i) => i.kind)).toEqual(['letter', 'seal', 'letter', 'day', 'letter', 'day']);
    expect(items[3]).toMatchObject({ text: 'Today' });
    expect(items[5]).toMatchObject({ text: 'Yesterday' });
    // A time sits under the newest letter and wherever the talk paused (15 minutes or more).
    expect(items.filter((i) => i.kind === 'letter').map((i) => (i as { time?: string }).time)).toEqual([
      '10:00',
      '09:00',
      '21:40',
    ]);
    const quick = itemsOf(
      [letter('e', true, '2026-10-07T10:05:00'), letter('d', false, '2026-10-07T10:00:00')],
      now,
    ).filter((i) => i.kind === 'letter');
    expect(quick.map((i) => (i as { time?: string }).time)).toEqual(['10:05', undefined]);
  });
});
