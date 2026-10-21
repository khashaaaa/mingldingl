import type { MembershipView } from '@/lib/api/generated/model';
import { setLocale } from '@/lib/i18n';
import { guildStage, tugrik } from '../GuildHouse';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION' },
}));
jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));

const yard: MembershipView = { floor: 'yard', until: null, source: null, renews: false, open: true };
const hall: MembershipView = {
  floor: 'hall',
  until: '2026-12-05T00:00:00Z',
  source: 'store',
  renews: true,
  open: true,
};

describe('the Guild House', () => {
  beforeAll(() => setLocale('en'));

  test('is sealed while the engine or the build cannot sell', () => {
    expect(guildStage(undefined, true, 'idle')).toBe('sealed');
    expect(guildStage({ ...yard, open: false }, true, 'idle')).toBe('sealed');
    expect(guildStage(yard, false, 'idle')).toBe('sealed');
  });

  test('waits after a purchase until the engine says the floor is open, then welcomes', () => {
    expect(guildStage(yard, true, 'idle')).toBe('choose');
    expect(guildStage(yard, true, 'paying')).toBe('paying');
    expect(guildStage(yard, true, 'bought')).toBe('paying');
    expect(guildStage(hall, true, 'bought')).toBe('welcome');
  });

  test('shows a member their floor, and a failure without a floor change', () => {
    expect(guildStage(hall, true, 'idle')).toBe('member');
    expect(guildStage(yard, true, 'failed')).toBe('failed');
  });

  test('writes tögrög the Guild House way', () => {
    expect(tugrik(29430)).toBe('29,430₮');
  });
});
