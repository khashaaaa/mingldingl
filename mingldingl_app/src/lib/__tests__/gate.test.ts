import type { AppStatusView, MeView } from '../api/generated/model';
import { type Belongs, semverLt, whereBelongs } from '../gate';

const app: AppStatusView = {
  minVersion: '1.0.0',
  maintenance: false,
  photosMin: 3,
  photosMax: 6,
  restMinutes: 40,
  deleteDays: 30,
  finishedPoints: 50,
};
const me = (over: Partial<MeView> = {}): MeView => ({
  accountId: 'a',
  status: 'Active',
  phoneHint: '9911',
  deleteAt: null,
  profile: null,
  onboardingStep: 7,
  ...over,
});
const v = '1.0.0';

const rows: [string, Parameters<typeof whereBelongs>[0], Belongs][] = [
  [
    'maintenance beats everything',
    { session: 'present', me: me(), app: { ...app, maintenance: true }, appVersion: v },
    { group: 'closed', why: 'maintenance' },
  ],
  [
    'an old build must update, even signed out',
    { session: 'none', app: { ...app, minVersion: '1.2.0' }, appVersion: '1.1.9' },
    { group: 'closed', why: 'update' },
  ],
  ['unknown session keeps the splash', { session: 'unknown', app, appVersion: v }, { group: 'loading' }],
  ['no session is the Gate', { session: 'none', app, appVersion: v }, { group: 'out' }],
  [
    'session without /me yet keeps the splash',
    { session: 'present', app, appVersion: v },
    { group: 'loading' },
  ],
  [
    'suspended',
    { session: 'present', me: me({ status: 'Suspended' }), app, appVersion: v },
    { group: 'closed', why: 'suspended' },
  ],
  [
    'deleted',
    { session: 'present', me: me({ status: 'Deleted' }), app, appVersion: v },
    { group: 'closed', why: 'deleted' },
  ],
  [
    'onboarding step from the server',
    { session: 'present', me: me({ onboardingStep: 3 }), app, appVersion: v },
    { group: 'onboarding', step: 3 },
  ],
  ['step 7 is the world', { session: 'present', me: me(), app, appVersion: v }, { group: 'world' }],
  [
    'app status not loaded yet does not block a signed-in person',
    { session: 'present', me: me(), appVersion: v },
    { group: 'world' },
  ],
];

test.each(rows)('%s', (_, input, expected) => {
  expect(whereBelongs(input)).toEqual(expected);
});

test('semver compares numerically', () => {
  expect(semverLt('1.9.0', '1.10.0')).toBe(true);
  expect(semverLt('1.10.0', '1.9.0')).toBe(false);
  expect(semverLt('1.0.0', '1.0.0')).toBe(false);
  expect(semverLt('1.0', '1.0.1')).toBe(true);
});
