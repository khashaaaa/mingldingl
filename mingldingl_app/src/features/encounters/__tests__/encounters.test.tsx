import type { QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Share } from 'react-native';
import WorldLayout from '@/app/(world)/_layout';
import type {
  BondView,
  EncounterView,
  MeetingView,
  TrialQuestionView,
  TrialView,
  VenueView,
} from '@/lib/api/generated/model';
import { applyLiveEvent } from '@/lib/live/events';
import { ME, settle, showWorld } from '@/lib/testing/world';
import { toast } from '@/lib/toast';
import AttendanceScreen from '../AttendanceScreen';
import CallScreen from '../CallScreen';
import IcebreakerScreen from '../IcebreakerScreen';
import MeetingScreen from '../MeetingScreen';
import { encounterNudge, SafetyRow, stepOf } from '../NextStep';
import RateScreen from '../RateScreen';
import RiteScreen from '../RiteScreen';
import TrialScreen, { trialLine } from '../TrialScreen';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), apiFetch: jest.fn() }));
jest.mock('@/lib/toast', () => ({ ...jest.requireActual('@/lib/toast'), toast: jest.fn() }));
jest.mock('react-native-agora', () => ({ RtcSurfaceView: () => null }));
// The call's shades are Skia (no JSI under jest).
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  LinearGradient: () => null,
  Rect: () => null,
  vec: (x: number, y: number) => ({ x, y }),
}));
jest.mock('@/lib/rite', () => ({ askForCallDevices: jest.fn(async () => true), openCall: jest.fn() }));

const { apiFetch } = jest.requireMock('@/lib/api/client') as { apiFetch: jest.Mock };
const { ApiError } = jest.requireActual('@/lib/api/client');
const rite = jest.requireMock('@/lib/rite') as { openCall: jest.Mock };

const BOND = {
  id: 'b1',
  state: 'Live',
  other: { accountId: 'saruul', name: 'Saruul', portraits: [] },
} as unknown as BondView;

const VENUE: VenueView = {
  id: 'v1',
  name: 'Nomad Tea House',
  nameMn: null,
  kind: 'Cafe',
  district: 'Sükhbaatar (UB)',
  address: 'Peace Avenue 12',
  hours: '09:00–22:00',
  description: null,
  addressMn: null,
  hoursMn: null,
  descriptionMn: null,
  rating: 4.5,
  ratings: 2,
  photos: [],
  gone: false,
};

const question = (n: number): TrialQuestionView => ({
  text: `Question ${n}?`,
  choices: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
  hints: ['', '', '', ''],
});

const REWARDS = { icebreaker: 20, trial: 15, rite: 30, meeting: 50, oathProven: 40 };

const encounter = (over: Partial<EncounterView> = {}): EncounterView => ({
  next: 'icebreaker',
  icebreaker: {
    question: 'What would you carry across the steppe?',
    mine: null,
    theirs: null,
    revealed: false,
  },
  trial: null,
  rite: null,
  meeting: null,
  rewards: REWARDS,
  ...over,
});

const meeting = (over: Partial<MeetingView> = {}): MeetingView => ({
  id: 'm1',
  venue: VENUE,
  at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  proposedByMe: false,
  myPledge: false,
  theirPledge: true,
  state: 'Proposed',
  checkUntil: null,
  myAnswer: null,
  outcome: null,
  canRate: false,
  ...over,
});

type World = {
  e: EncounterView;
  posts: { path: string; body: unknown }[];
  reply: Record<string, () => unknown>;
};

function fakeEngine(): World {
  const w: World = { e: encounter(), posts: [], reply: {} };
  apiFetch.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.split('?')[0] ?? url;
    const key = `${init.method} ${path}`;
    if (init.method === 'POST' || init.method === 'PUT') {
      w.posts.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
    }
    const reply = w.reply[key];
    if (reply) return reply();
    switch (key) {
      case 'GET /me':
        return ME;
      case 'POST /me/dawn':
        return { earned: 0, streak: 1, seventh: false };
      case 'GET /tiers':
        return [];
      case 'GET /bonds/b1':
        return BOND;
      case 'GET /bonds/b1/encounter':
        return w.e;
      case 'GET /venues':
        return [VENUE];
      case 'GET /venues/v1':
        return VENUE;
      default:
        throw new Error(`unrouted ${key}`);
    }
  });
  return w;
}

const ROUTES = {
  '(world)/_layout': WorldLayout,
  '(world)/bond/[id]': () => null,
  '(world)/icebreaker/[id]': IcebreakerScreen,
  '(world)/trial/[id]': TrialScreen,
  '(world)/rite/[id]': RiteScreen,
  '(world)/call/[id]': CallScreen,
  '(world)/meeting/[id]': MeetingScreen,
  '(world)/venue/[id]': () => null,
  '(world)/attendance/[id]': AttendanceScreen,
  '(world)/rate/[id]': RateScreen,
  '(world)/options': () => <SafetyRow bondId="b1" name="Saruul" done={closeOptions} />,
};
const closeOptions = jest.fn();

const show = (url: string) => showWorld(ROUTES, url, { settles: 4 });

const press = async (name: string | RegExp, role: 'button' | 'link' | 'radio' = 'button') => {
  await fireEvent.press(screen.getByRole(role, { name }));
  await settle();
  await settle();
};
const live = async (client: QueryClient) => {
  await act(() => applyLiveEvent(client, { kind: 'encounter.updated', ids: ['b1'] }, jest.fn()));
  await settle();
  await settle();
};

let w: World;
beforeEach(() => {
  jest.clearAllMocks();
  w = fakeEngine();
});

describe('Icebreaker', () => {
  test('answer → sealed → both answers open together on a live event', async () => {
    const { client } = await show('/icebreaker/b1');
    expect(screen.getByText('What would you carry across the steppe?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seal my answer' })).toBeDisabled();

    const sealed = {
      question: 'What would you carry across the steppe?',
      mine: 'A kettle and a good horse.',
      theirs: null,
      revealed: false,
    };
    w.reply['POST /bonds/b1/encounter/icebreaker'] = () => ({ ...w.e, icebreaker: sealed });
    await fireEvent.changeText(screen.getByLabelText('Your answer'), '  A kettle and a good horse. ');
    await press('Seal my answer');
    expect(w.posts.at(-1)).toEqual({
      path: '/bonds/b1/encounter/icebreaker',
      body: { text: 'A kettle and a good horse.' },
    });
    expect(screen.getByText('Your answer is sealed')).toBeTruthy();

    w.e = { ...w.e, next: 'rite', icebreaker: { ...sealed, theirs: 'Salt and a song.', revealed: true } };
    await live(client);
    expect(screen.getByText('Salt and a song.')).toBeTruthy();
    expect(screen.getByText('A kettle and a good horse.')).toBeTruthy();
  });

  test('a refused answer says why', async () => {
    w.reply['POST /bonds/b1/encounter/icebreaker'] = () => {
      throw new ApiError('rule', 409, 'encounter.answered', 'answered');
    };
    await show('/icebreaker/b1');
    await fireEvent.changeText(screen.getByLabelText('Your answer'), 'x');
    await press('Seal my answer');
    expect(toast).toHaveBeenCalledWith('error', expect.any(String));
    expect(screen.getByRole('button', { name: 'Seal my answer' })).toBeTruthy();
  });
});

describe('Trial', () => {
  const trial = (mine: number[]) =>
    encounter({
      next: 'trial',
      trial: { questions: [1, 2, 3, 4, 5].map(question), mine, theyFinished: false, result: null },
    });

  test('resumes at the first unanswered question, and a choice answers it at once', async () => {
    w.e = trial([0, 2]);
    w.reply['POST /bonds/b1/encounter/trial'] = () => trial([0, 2, 1]);
    await show('/trial/b1');
    expect(screen.getByText('QUESTION 3 OF 5')).toBeTruthy();
    expect(screen.getByText('Question 3?')).toBeTruthy();
    await press('b3', 'radio');
    expect(w.posts.at(-1)?.body).toEqual({ index: 2, choice: 1 });
    expect(screen.getByText('Question 4?')).toBeTruthy();
  });

  test('all five sealed waits; the result opens with the score and the line', async () => {
    w.e = trial([0, 1, 2, 3, 0]);
    const { client } = await show('/trial/b1');
    expect(screen.getByText('Your answers are sealed')).toBeTruthy();
    const result = {
      same: 3,
      percent: 60,
      sameTopics: ['mornings', 'money'],
      differTopics: ['pets'],
      theirs: [],
    };
    w.e = { ...trial([0, 1, 2, 3, 0]), trial: { ...(w.e.trial as TrialView), theyFinished: true, result } };
    await live(client);
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('Kindred in three of five')).toBeTruthy();
    expect(screen.getByText('You agree on mornings and money. You differ on pets.')).toBeTruthy();
  });

  test('the line joins three topics with commas', () => {
    expect(
      trialLine({ same: 3, percent: 60, sameTopics: ['a', 'b', 'c'], differTopics: [], theirs: [] }),
    ).toBe('You agree on a, b and c.');
  });
});

describe('Flame Rite', () => {
  const riteAt = (state: string, call: EncounterView['rite'] extends infer R ? R : never = null) =>
    encounter({ next: 'rite', rite: { state, canProposeAt: null, required: true, call: call as never } });

  test('propose → waiting; the other side accepts or says not now', async () => {
    w.e = riteAt('open');
    w.reply['POST /bonds/b1/rite'] = () => riteAt('proposedByMe');
    await show('/rite/b1');
    await press('Propose the Rite');
    expect(w.posts.at(-1)?.path).toBe('/bonds/b1/rite');
    expect(screen.getByText('The Rite is asked for')).toBeTruthy();
  });

  test('asked by them: Accept answers yes and the fire can be entered', async () => {
    w.e = riteAt('proposedByThem');
    w.reply['POST /bonds/b1/rite/answer'] = () => riteAt('accepted');
    await show('/rite/b1');
    expect(screen.getByText('Saruul asks for the Flame Rite')).toBeTruthy();
    await press('Accept');
    expect(w.posts.at(-1)).toEqual({ path: '/bonds/b1/rite/answer', body: { accept: true } });
    expect(screen.getByRole('button', { name: 'Light the fire' })).toBeTruthy();
  });

  test('not now answers no', async () => {
    w.e = riteAt('proposedByThem');
    w.reply['POST /bonds/b1/rite/answer'] = () => riteAt('open');
    await show('/rite/b1');
    await press('Not now', 'link');
    expect(w.posts.at(-1)).toEqual({ path: '/bonds/b1/rite/answer', body: { accept: false } });
  });
});

describe('The call', () => {
  const ticket = {
    callId: 'c1',
    appId: 'app',
    channel: 'ch',
    token: 'tok',
    uid: 7,
    issuedAt: '',
    minutes: 5,
  };
  const handle = { mute: jest.fn(), camera: jest.fn(), leave: jest.fn() };
  let events: { onJoined: () => void; onRemote: (uid: number | null) => void; onLost: () => void };

  beforeEach(() => {
    rite.openCall.mockImplementation((_t, e) => {
      events = e;
      return handle;
    });
    w.reply['POST /bonds/b1/rite/call'] = () => ticket;
    w.reply['POST /video/calls/c1/presence'] = () => undefined;
  });

  const inCall = (endsAt: string | null) =>
    encounter({
      next: 'rite',
      rite: {
        state: 'accepted',
        canProposeAt: null,
        required: true,
        call: { id: 'c1', issuedAt: '', endsAt, ended: false, completed: false },
      },
    });

  test('kindles until they step in, then counts down from the engine’s end', async () => {
    w.e = inCall(new Date(Date.now() + 4 * 60_000 + 30_000).toISOString());
    await show('/call/b1');
    expect(screen.getByText('Kindling the fire…')).toBeTruthy();
    expect(rite.openCall).toHaveBeenCalledWith(ticket, expect.anything());
    await act(async () => events.onRemote(42));
    await settle();
    expect(screen.getByTestId('rite-live')).toBeTruthy();
    expect(screen.getByLabelText(/^4:(29|30)$/)).toBeTruthy();
  });

  test('0:00 ends the call and returns to the Rite', async () => {
    // the clock has run out by the time they step in
    w.e = inCall(new Date(Date.now() - 1000).toISOString());
    const { view } = await show('/call/b1');
    await act(async () => events.onRemote(42));
    await settle();
    await settle();
    expect(handle.leave).toHaveBeenCalled();
    expect(view.getPathname()).toBe('/rite/b1');
  });

  test('douse asks first, then tells the engine and leaves', async () => {
    w.e = inCall(new Date(Date.now() + 5 * 60_000).toISOString());
    w.reply['POST /bonds/b1/rite/douse'] = () =>
      encounter({
        next: 'rite',
        rite: { state: 'accepted', canProposeAt: null, required: true, call: null },
      });
    const { view } = await show('/call/b1');
    await act(async () => events.onRemote(42));
    await settle();
    await press('Douse');
    expect(screen.getByText('Douse the fire?')).toBeTruthy();
    await press('Douse the fire');
    expect(w.posts.map((p) => p.path)).toContain('/bonds/b1/rite/douse');
    expect(handle.leave).toHaveBeenCalled();
    expect(view.getPathname()).toBe('/rite/b1');
  });

  test('a lost way offers Try again, which opens a new attempt', async () => {
    w.e = inCall(null);
    await show('/call/b1');
    await act(async () => events.onLost());
    await settle();
    expect(screen.getByText('The way would not open')).toBeTruthy();
    await press('Try again', 'link');
    await settle();
    expect(rite.openCall).toHaveBeenCalledTimes(2);
  });
});

describe('Meeting', () => {
  test('their proposal: pledging swears it, and the safety share names place and time', async () => {
    w.e = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: meeting() } });
    w.reply['POST /bonds/b1/meeting/m1/pledge'] = () => ({
      ...w.e,
      meeting: { open: true, blocked: null, current: meeting({ myPledge: true, state: 'Sworn' }) },
    });
    await show('/meeting/b1');
    expect(screen.getByText('Saruul has pledged. Pledge too, and the meeting is sworn.')).toBeTruthy();
    await press('Pledge to meet');
    expect(screen.getByText('The meeting is sworn')).toBeTruthy();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await press('Share safety info');
    const message = (share.mock.calls[0]?.[0] as { message: string } | undefined)?.message ?? '';
    expect(message).toContain('Nomad Tea House');
    expect(message).toContain('Peace Avenue 12');
    expect(message).toContain('Sükhbaatar');
  });

  test('the bond’s options offer the safety share only while a meeting is sworn', async () => {
    w.e = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: meeting() } });
    await show('/options');
    expect(screen.queryByText('Share safety info')).toBeNull();

    w.e = encounter({
      next: 'meeting',
      meeting: { open: true, blocked: null, current: meeting({ myPledge: true, state: 'Sworn' }) },
    });
    await show('/options');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await fireEvent.press(screen.getByText('Share safety info'));
    expect(closeOptions).toHaveBeenCalled();
    expect((share.mock.calls[0]?.[0] as { message: string } | undefined)?.message).toContain(
      'Nomad Tea House',
    );
  });

  test('suggest another time opens the picker at the same place', async () => {
    w.e = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: meeting() } });
    await show('/meeting/b1');
    await press('Suggest another time', 'link');
    expect(screen.getByRole('button', { name: 'Pledge to meet' })).toBeDisabled();
    expect(screen.getByText('Nomad Tea House')).toBeTruthy();
  });

  test('nothing proposed lists the verified places', async () => {
    w.e = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: null } });
    await show('/meeting/b1');
    expect(screen.getByText('Nomad Tea House')).toBeTruthy();
    expect(screen.getByText(/★ 4\.5 \(2\)/)).toBeTruthy();
  });

  test('a removed place says so and offers another', async () => {
    const gone = meeting({ venue: { ...VENUE, gone: true } });
    w.e = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: gone } });
    await show('/meeting/b1');
    expect(screen.getByRole('button', { name: 'Choose another' })).toBeTruthy();
  });
});

describe('Attendance and rating', () => {
  const checking = encounter({
    next: 'attendance',
    meeting: { open: true, blocked: null, current: meeting({ state: 'Checking', myPledge: true }) },
  });

  test('an answer is sent privately; a kept meeting goes on to rating', async () => {
    w.e = checking;
    w.reply['POST /bonds/b1/meeting/m1/attendance'] = () => ({
      ...checking,
      next: 'rate',
      meeting: {
        open: true,
        blocked: null,
        current: meeting({ state: 'Closed', outcome: 'Kept', canRate: true }),
      },
    });
    const { view } = await show('/attendance/b1');
    expect(screen.getByText('Did Saruul come?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled();
    await press('We met', 'radio');
    await press('Answer');
    expect(w.posts.at(-1)?.body).toEqual({ answer: 'Met' });
    expect(view.getPathname()).toBe('/rate/b1');
    expect(screen.getByText('How was Nomad Tea House?')).toBeTruthy();
  });

  test('rating sends the chosen stars and returns to the bond', async () => {
    const closed = encounter({
      next: 'rate',
      meeting: { open: true, blocked: null, current: meeting({ state: 'Closed', canRate: true }) },
    });
    w.e = closed;
    w.reply['POST /bonds/b1/meeting/m1/rating'] = () => ({ ...closed, next: null });
    const { view } = await show('/bond/b1');
    await act(() => router.push('/rate/b1'));
    await settle();
    expect(screen.getByRole('button', { name: 'Rate' })).toBeDisabled();
    await press('4 of five');
    await press('Rate');
    expect(w.posts.at(-1)?.body).toEqual({ stars: 4 });
    expect(view.getPathname()).toBe('/bond/b1');
  });

  test('skip rates nothing', async () => {
    const closed = encounter({
      next: 'rate',
      meeting: { open: true, blocked: null, current: meeting({ state: 'Closed', canRate: true }) },
    });
    w.e = closed;
    w.reply['POST /bonds/b1/meeting/m1/rating'] = () => ({ ...closed, next: null });
    const { view } = await show('/bond/b1');
    await act(() => router.push('/rate/b1'));
    await settle();
    await press('Skip', 'link');
    expect(w.posts.at(-1)?.body).toEqual({ stars: 0 });
    expect(view.getPathname()).toBe('/bond/b1');
  });
});

describe('The next step and its nudges', () => {
  test('the card follows the earliest open step', () => {
    expect(stepOf('b1', 'Saruul', encounter({ next: null }))).toBeNull();
    expect(stepOf('b1', 'Saruul', encounter())?.title).toBe('Break the ice');
    const asked = encounter({
      next: 'rite',
      rite: { state: 'proposedByThem', canProposeAt: null, required: true, call: null },
    });
    expect(stepOf('b1', 'Saruul', asked)).toMatchObject({
      title: 'Saruul asks for the Flame Rite',
      route: '/rite/b1',
    });
    const theirs = encounter({ next: 'meeting', meeting: { open: true, blocked: null, current: meeting() } });
    expect(stepOf('b1', 'Saruul', theirs)?.title).toBe('Saruul pledged to meet');
  });

  test('nudges come from what changed, never from my own act', () => {
    const sealed = encounter({ icebreaker: { question: 'q', mine: 'a', theirs: null, revealed: false } });
    const open = encounter({ icebreaker: { question: 'q', mine: 'a', theirs: 'b', revealed: true } });
    expect(encounterNudge(sealed, open)).toBe('nudge.icebreaker');
    expect(encounterNudge(undefined, open)).toBeNull();
    const mine = encounter({
      meeting: { open: true, blocked: null, current: meeting({ myPledge: true, proposedByMe: true }) },
    });
    const sworn = encounter({
      meeting: { open: true, blocked: null, current: meeting({ myPledge: true, state: 'Sworn' }) },
    });
    expect(encounterNudge(mine, sworn)).toBe('nudge.meeting');
    expect(
      encounterNudge(encounter(), encounter({ meeting: { open: true, blocked: null, current: meeting() } })),
    ).toBe('nudge.meetingProposed');
  });
});
