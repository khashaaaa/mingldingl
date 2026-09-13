import { render } from '@testing-library/react-native';
import MatchesScreen from '../matches';
import { useMatches } from '../../../hooks/useMatches';
import { useMyUserId } from '../../../hooks/useMyUserId';
import { useScoreDetail } from '../../../hooks/useScoreDetail';
import { useTownSquareSession } from '../../../hooks/useTownSquareSession';
import { WithSafeArea } from '../../../lib/testing/safeArea';
import type { Match } from '../../../models/match';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

// Each hook is stubbed directly rather than wrapped in a QueryClientProvider — the same choice
// `profile.test.tsx` makes — since this test cares only about the footer QuestTile's own list
// renders, not the score HUD or the gathering pill underneath it.
jest.mock('../../../hooks/useMatches');
jest.mock('../../../hooks/useMyUserId');
jest.mock('../../../hooks/useScoreDetail');
jest.mock('../../../hooks/useTownSquareSession', () => ({ useTownSquareSession: jest.fn() }));

const mockUseMatches = useMatches as jest.Mock;
const mockUseMyUserId = useMyUserId as jest.Mock;
const mockUseScoreDetail = useScoreDetail as jest.Mock;
const mockUseTownSquareSession = useTownSquareSession as jest.Mock;

const BASE_MATCH: Match = {
  matchId: 'm1',
  otherUserId: 'u2',
  status: 'Active',
  revealLevel: 2,
  messageCount: 0,
  icebreakerComplete: false,
  videoCallUnlocked: false,
  otherUser: { displayName: 'Riley' },
  flameRiteDurationMinutes: 5,
  flameRiteRequired: false,
  videoEnabled: true,
};

function renderScreen() {
  return render(
    <WithSafeArea>
      <MatchesScreen />
    </WithSafeArea>,
  );
}

beforeEach(() => {
  mockUseMyUserId.mockReturnValue('me');
  mockUseScoreDetail.mockReturnValue({ data: undefined });
  mockUseTownSquareSession.mockReturnValue({ session: undefined, isLoading: false });
  mockUseMatches.mockReturnValue({
    data: [BASE_MATCH],
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  });
});

describe('MatchesScreen', () => {
  it('speaks the law under the list of fires', () => {
    const { getByText } = renderScreen();
    expect(
      getByText("A fire is judged at dawn. Whoever's turn it was when it froze is the one who let it."),
    ).toBeTruthy();
  });

  it('says nothing about the law on the empty state', () => {
    mockUseMatches.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    const { queryByText } = renderScreen();
    expect(
      queryByText("A fire is judged at dawn. Whoever's turn it was when it froze is the one who let it."),
    ).toBeNull();
  });
});
