import { render } from '@testing-library/react-native';
import ProfileScreen from '../profile';
import { useProfile } from '../../../hooks/useProfile';
import { useScoreDetail } from '../../../hooks/useScoreDetail';
import { useInventory } from '../../../hooks/useInventory';
import { useCancelDeletion } from '../../../hooks/useCancelDeletion';
import { useMilestones } from '../../../hooks/useMilestones';
import { useDailyMatchBudget } from '../../../hooks/useScore';
import { WithSafeArea } from '../../../lib/testing/safeArea';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('../../../hooks/useProfile');
jest.mock('../../../hooks/useScoreDetail');
jest.mock('../../../hooks/useInventory');
jest.mock('../../../hooks/useCancelDeletion');
jest.mock('../../../hooks/useMilestones');
jest.mock('../../../hooks/useScore');

// These cards aren't part of task 8 and reach their own network/native hooks (video share sheet,
// honour trophies, the invite share sheet, oath swearing, photo upload) — stubbed so the screen
// mounts on the two hooks/data shapes this test actually cares about.
jest.mock('../../../components/NextActionCard', () => ({ NextActionCard: () => null }));
jest.mock('../../../components/progression/HonourCase', () => ({ HonourCase: () => null }));
jest.mock('../../../components/progression/InviteAllyCard', () => ({ InviteAllyCard: () => null }));
jest.mock('../../../components/progression/ThreadLog', () => ({ ThreadLog: () => null }));
jest.mock('../../../components/progression/GemTierBadge', () => ({ GemTierBadge: () => null }));
jest.mock('../../../components/cards/ShareCharacterButton', () => ({ ShareCharacterButton: () => null }));
jest.mock('../../../components/profile/OathCard', () => ({ OathCard: () => null }));
jest.mock('../../../components/profile/ProfileAvatar', () => ({ ProfileAvatar: () => null }));
jest.mock('../../../components/profile/DeletionPendingBanner', () => ({ DeletionPendingBanner: () => null }));

const mockUseProfile = useProfile as jest.Mock;
const mockUseScoreDetail = useScoreDetail as jest.Mock;
const mockUseInventory = useInventory as jest.Mock;
const mockUseCancelDeletion = useCancelDeletion as jest.Mock;
const mockUseMilestones = useMilestones as jest.Mock;
const mockUseDailyMatchBudget = useDailyMatchBudget as jest.Mock;

const profile = {
  displayName: 'Bataar',
  age: 27,
  city: 'Ulaanbaatar',
  bio: 'Loves chess.',
  photoUrls: ['p1.jpg'],
  membershipLevel: 'Free',
  isProfileComplete: false,
  deletionRequestedAt: null,
  referralCode: 'ABC123',
};

const scoreDetail = {
  totalScore: 90,
  gemTier: 'Garnet',
  nextTier: 'Opal',
  progressPct: 60,
  currentStreak: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({ data: profile });
  mockUseScoreDetail.mockReturnValue({ data: scoreDetail });
  mockUseInventory.mockReturnValue({ items: [] });
  mockUseCancelDeletion.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseMilestones.mockReturnValue({ milestones: [], isLoading: false, open: jest.fn(), isOpening: false });
  mockUseDailyMatchBudget.mockReturnValue({ budget: 5, used: 2, remaining: 3 });
});

function renderScreen() {
  return render(<ProfileScreen />, { wrapper: WithSafeArea });
}

describe('ProfileScreen chrome (task 8: moved from Seek)', () => {
  it('renders the getting-started card below the character cards', () => {
    // CardEyebrow uppercases its own children (task-8's discover.test.tsx checks the same card
    // pre-uppercase, since it queries plain body text on the compact/full-step rows instead).
    const { getByText } = renderScreen();
    expect(getByText('FIRST STEPS')).toBeTruthy();
  });

  it('renders the daily summons budget meter', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('daily-budget-meter')).toBeTruthy();
  });

  it('hides the getting-started card once every step is done, same as it did on Seek', () => {
    mockUseMilestones.mockReturnValue({
      milestones: [{ id: 'first_match', achievedAt: '2026-01-01' }, { id: 'first_icebreaker', achievedAt: '2026-01-01' }, { id: 'first_quiz', achievedAt: '2026-01-01' }],
      isLoading: false,
      open: jest.fn(),
      isOpening: false,
    });
    mockUseProfile.mockReturnValue({ data: { ...profile, isProfileComplete: true } });
    const { queryByText } = renderScreen();
    expect(queryByText('FIRST STEPS')).toBeNull();
  });

  it('hides the budget meter when no budget is known, same as it did on Seek', () => {
    mockUseDailyMatchBudget.mockReturnValue(null);
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('daily-budget-meter')).toBeNull();
  });
});
