import { render, fireEvent } from '@testing-library/react-native';
import MembershipScreen from '../membership';
import type { MembershipTier } from '../../models/membership';

jest.mock('expo-router', () => ({ usePathname: () => '/test', useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../../hooks/useScrollTail', () => ({ useScrollTail: () => 0 }));

const mockUpgrade = jest.fn();
let mockCurrentLevel: string | undefined = 'Free';

// Three floors, the shape the engine actually sends: the Yard has no price, the upper two do,
// and each carries a couple of feature keys through the `perk_<key>` family.
const TIERS: MembershipTier[] = [
  {
    level: 'Free', dailyMatches: 3, deepProfileView: false, monthlyPriceMnt: null,
    featureKeys: ['basic_profile'], prices: [],
  },
  {
    level: 'Silver', dailyMatches: 8, deepProfileView: false, monthlyPriceMnt: 15000,
    featureKeys: ['icebreakers_quizzes'],
    prices: [
      { durationMonths: 1, totalPriceMnt: 15000, pricePerMonthMnt: 15000, discountPct: 0 },
      { durationMonths: 3, totalPriceMnt: 42000, pricePerMonthMnt: 14000, discountPct: 7 },
      { durationMonths: 6, totalPriceMnt: 81000, pricePerMonthMnt: 13500, discountPct: 10 },
    ],
  },
  {
    level: 'Gold', dailyMatches: 20, deepProfileView: true, monthlyPriceMnt: 35000,
    featureKeys: ['deep_profile_view', 'priority_matching'],
    prices: [{ durationMonths: 1, totalPriceMnt: 35000, pricePerMonthMnt: 35000, discountPct: 0 }],
  },
];

jest.mock('../../hooks/useMembership', () => ({
  useMembership: () => ({
    currentLevel: mockCurrentLevel,
    expiresAt: null,
    isLoading: false,
    tiers: TIERS,
    tiersLoading: false,
    upgrade: mockUpgrade,
    isUpgrading: false,
    upgradeError: false,
  }),
}));

describe('MembershipScreen — the Guild House', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentLevel = 'Free';
  });

  it('draws the three floors top to bottom: the High Table, the Hall, the Yard', () => {
    const { toJSON } = render(<MembershipScreen />);
    const drawn = JSON.stringify(toJSON());
    const highTable = drawn.indexOf('The High Table');
    const hall = drawn.indexOf('The Hall');
    const yard = drawn.indexOf('The Yard');
    expect(highTable).toBeGreaterThan(-1);
    expect(hall).toBeGreaterThan(highTable);
    expect(yard).toBeGreaterThan(hall);
  });

  it('marks the Yard as home for a Free member', () => {
    mockCurrentLevel = 'Free';
    const { getByText } = render(<MembershipScreen />);
    // CardEyebrow renders its own label upper-cased.
    expect(getByText('YOU ARE HERE')).toBeTruthy();
  });

  it('defaults to the floor above and climbs to it on the standing duration', () => {
    mockCurrentLevel = 'Free';
    // The button law is two words at most, so the visible label is short — the destination
    // still has to be announced, so it's the accessibility label instead.
    const { getByText, getByLabelText } = render(<MembershipScreen />);
    expect(getByText('CLIMB')).toBeTruthy();
    const button = getByLabelText('Climb to The Hall');
    fireEvent.press(button);
    expect(mockUpgrade).toHaveBeenCalledWith('Silver', 1);
  });

  it('gives a Gold member no button, and the top-floor sub', () => {
    mockCurrentLevel = 'Gold';
    const { queryByText, getByText } = render(<MembershipScreen />);
    expect(queryByText('CLIMB')).toBeNull();
    expect(getByText('You sit at the High Table. There is nothing above.')).toBeTruthy();
  });

  it('shows the total and its savings only once a longer duration is chosen', () => {
    mockCurrentLevel = 'Free';
    const { getByText, queryByText } = render(<MembershipScreen />);
    // One month: the flat monthly price on the floor already says the whole story.
    expect(queryByText(/total/)).toBeNull();
    fireEvent.press(getByText('6 Months'));
    expect(getByText('₮81,000 total · Save 10%')).toBeTruthy();
  });
});
