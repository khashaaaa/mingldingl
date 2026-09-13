import { render } from '@testing-library/react-native';
import ProfileScreen from '../profile';
import { useProfile } from '../../../hooks/useProfile';
import { useScoreDetail } from '../../../hooks/useScoreDetail';
import { useInventory } from '../../../hooks/useInventory';
import { useCancelDeletion } from '../../../hooks/useCancelDeletion';
import { WithSafeArea } from '../../../lib/testing/safeArea';

jest.mock('expo-router', () => ({ usePathname: () => '/test', useRouter: () => ({ push: jest.fn() }) }));

jest.mock('../../../hooks/useProfile');
jest.mock('../../../hooks/useScoreDetail');
jest.mock('../../../hooks/useInventory');
jest.mock('../../../hooks/useCancelDeletion');

// These cards reach their own network/native hooks (video share sheet, honour trophies, the invite
// share sheet, oath swearing, photo upload) — stubbed so the screen mounts on the hooks and data
// shapes this test actually cares about.
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
});

function renderScreen() {
  return render(<ProfileScreen />, { wrapper: WithSafeArea });
}

describe('ProfileScreen chrome (Sealed Fire W4 task 5: moved on to the hearth)', () => {
  // Both strips came here off Seek in task 8 and have moved on to the hearth, where the dawn, the
  // wax and the fires are. The sheet is the character again: rank, score, oath, bio, honours.
  it('no longer holds the First Steps board', () => {
    // CardEyebrow uppercases its own children, so this is the literal rendered text.
    const { queryByText } = renderScreen();
    expect(queryByText('FIRST STEPS')).toBeNull();
  });

  it('no longer holds the daily summons budget', () => {
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('daily-budget-meter')).toBeNull();
    expect(queryByTestId('candle-row')).toBeNull();
  });

  it('still draws the character it is for', () => {
    // The guard on the two tests above: a screen that failed to render at all would also fail to
    // render the two things they say are gone.
    const { getByText } = renderScreen();
    expect(getByText('Bataar')).toBeTruthy();
    expect(getByText('TOTAL SCORE')).toBeTruthy();
  });
});
